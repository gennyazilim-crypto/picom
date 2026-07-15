import http from "node:http";
import os from "node:os";
import { createHash, createHmac, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { EMAIL_IDENTITY, assertSenderPolicy, normalizeRecipient } from "./emailPolicy.mjs";
import { TEMPLATE_CATEGORY, renderEmailTemplate } from "./templates.mjs";

const required = (name) => { const value = String(process.env[name] ?? "").trim(); if (!value) throw new Error(`EMAIL_CONFIG_MISSING:${name}`); return value; };
const numberEnv = (name, fallback, min, max) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : fallback; };
const boolEnv = (name, fallback = false) => { const value = String(process.env[name] ?? "").toLowerCase(); return value ? value === "true" : fallback; };

const config = Object.freeze({
  supabaseUrl: required("SUPABASE_URL"), serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  smtpHost: process.env.SMTP_HOST?.trim() || "mail.spacemail.com", smtpPort: numberEnv("SMTP_PORT",465,1,65535), smtpSecure: boolEnv("SMTP_SECURE",true),
  smtpUser: required("SMTP_USER"), smtpPassword: required("SMTP_PASSWORD"),
  pollMs: numberEnv("EMAIL_WORKER_POLL_MS",2500,500,60000), batchSize: numberEnv("EMAIL_WORKER_BATCH_SIZE",10,1,50),
  maxConnections: numberEnv("EMAIL_SMTP_MAX_CONNECTIONS",2,1,5), maxMessages: numberEnv("EMAIL_SMTP_MAX_MESSAGES",50,1,500),
  hourlyLimit: numberEnv("EMAIL_PROVIDER_HOURLY_LIMIT",80,1,10000), healthPort: numberEnv("EMAIL_HEALTH_PORT",8788,1024,65535),
  unsubscribeSecret: required("EMAIL_UNSUBSCRIBE_SECRET"), publicApiBase: required("PICOM_EMAIL_PUBLIC_API_BASE"),
});

assertSenderPolicy({ fromAddress: process.env.PICOM_MAIL_FROM, fromName: process.env.PICOM_MAIL_FROM_NAME, replyTo: process.env.PICOM_MAIL_REPLY_TO });
if (config.smtpUser.toLowerCase() !== EMAIL_IDENTITY.fromAddress) throw new Error("EMAIL_SMTP_USER_POLICY_VIOLATION");

const workerId = `${os.hostname()}:${process.pid}:${randomUUID().slice(0,8)}`;
const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const transport = nodemailer.createTransport({
  host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, pool: true,
  maxConnections: config.maxConnections, maxMessages: config.maxMessages, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  auth: { user: config.smtpUser, pass: config.smtpPassword }, tls: { minVersion: "TLSv1.2", servername: config.smtpHost, rejectUnauthorized: true },
});

let shuttingDown = false;
let processing = false;
let lastHealth = { status: "starting", smtpStatus: "unknown", latencyMs: null, lastErrorCode: null, checkedAt: new Date().toISOString() };

const hashEmail = (email) => createHash("sha256").update(email).digest("hex");
const redactError = (error) => String(error?.code || error?.responseCode || "SMTP_FAILURE").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120);
const isTemporary = (error) => [421,450,451,452].includes(Number(error?.responseCode)) || ["ETIMEDOUT","ECONNECTION","ECONNRESET","EDNS"].includes(String(error?.code));
const nextAttempt = (attempt) => new Date(Date.now() + Math.min(6*60*60*1000, (2 ** Math.min(attempt,10))*30000 + Math.floor(Math.random()*30000))).toISOString();

function createUnsubscribeToken(message) {
  const payload = Buffer.from(JSON.stringify({ userId: message.recipient_user_id, emailHash: hashEmail(message.recipient_email), category: message.category, exp: Date.now()+30*24*60*60*1000 })).toString("base64url");
  const signature = createHmac("sha256",config.unsubscribeSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function heartbeat(status, smtpStatus, latencyMs=null, errorCode=null, processed=0, failed=0) {
  lastHealth = { status, smtpStatus, latencyMs, lastErrorCode: errorCode, checkedAt: new Date().toISOString() };
  await supabase.rpc("record_email_worker_heartbeat",{ p_worker_id:workerId,p_status:status,p_smtp_status:smtpStatus,p_latency_ms:latencyMs,p_error_code:errorCode,p_processed_increment:processed,p_failed_increment:failed });
}

async function verifySmtp() {
  const started = Date.now();
  try { await transport.verify(); await heartbeat("healthy","healthy",Date.now()-started); return true; }
  catch(error) { const code=redactError(error); const status=String(error?.code)==="EAUTH"?"auth_failed":String(error?.code)==="ETLS"?"tls_failed":"unavailable"; await heartbeat("degraded",status,Date.now()-started,code,0,1); return false; }
}

async function providerCapacityAvailable() {
  const { count, error } = await supabase.from("email_messages").select("id",{count:"exact",head:true}).eq("status","accepted").gte("accepted_at",new Date(Date.now()-60*60*1000).toISOString());
  return !error && (count ?? 0) < config.hourlyLimit;
}

async function processMessage(message) {
  const startedAt = new Date(); const started = Date.now();
  const recipient = normalizeRecipient(message.recipient_email);
  const emailHash = hashEmail(recipient);
  const { data: suppressed } = await supabase.rpc("is_email_suppressed",{ p_user_id:message.recipient_user_id,p_email_hash:emailHash,p_category:message.category });
  if (suppressed && message.category !== "required_account_security" && message.category !== "billing") {
    await supabase.rpc("complete_email_attempt",{p_message_id:message.id,p_outcome:"cancelled",p_provider_response_category:"suppressed",p_provider_message_id:null,p_smtp_response_code:null,p_error_code:"EMAIL_SUPPRESSED",p_latency_ms:Date.now()-started,p_started_at:startedAt.toISOString(),p_next_attempt_at:null}); return;
  }
  const optional = !["required_account_security","billing"].includes(message.category);
  const token = optional ? createUnsubscribeToken(message) : null;
  const unsubscribeUrl = token ? `${config.publicApiBase}?action=unsubscribe&token=${encodeURIComponent(token)}` : null;
  const rendered = renderEmailTemplate(message.template_id,message.locale,message.parameters,unsubscribeUrl);
  try {
    const result = await transport.sendMail({
      from: { name: EMAIL_IDENTITY.fromName, address: EMAIL_IDENTITY.fromAddress }, replyTo: EMAIL_IDENTITY.replyTo, to: recipient,
      subject: rendered.subject, text: rendered.text, html: rendered.html,
      messageId: `<${message.id}@picom.gg>`, headers: { "X-Picom-Correlation-ID": message.correlation_id, "X-Picom-Template": `${message.template_id}@${message.template_version}`,
        ...(unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post":"List-Unsubscribe=One-Click" } : {}) },
    });
    await supabase.rpc("complete_email_attempt",{p_message_id:message.id,p_outcome:"accepted",p_provider_response_category:"smtp_accepted",p_provider_message_id:String(result.messageId||"").slice(0,255),p_smtp_response_code:Number(result.response?.match(/^([0-9]{3})/)?.[1]||250),p_error_code:null,p_latency_ms:Date.now()-started,p_started_at:startedAt.toISOString(),p_next_attempt_at:null});
    await heartbeat("healthy","healthy",Date.now()-started,null,1,0);
  } catch(error) {
    const temporary=isTemporary(error); const code=redactError(error);
    await supabase.rpc("complete_email_attempt",{p_message_id:message.id,p_outcome:temporary?"temporary_failure":"permanent_failure",p_provider_response_category:temporary?"smtp_temporary":"smtp_permanent",p_provider_message_id:null,p_smtp_response_code:Number(error?.responseCode)||null,p_error_code:code,p_latency_ms:Date.now()-started,p_started_at:startedAt.toISOString(),p_next_attempt_at:temporary?nextAttempt(message.attempt_count):null});
    await heartbeat("degraded",String(error?.code)==="EAUTH"?"auth_failed":"unavailable",Date.now()-started,code,0,1);
  }
}

async function tick() {
  if (shuttingDown || processing) return;
  processing=true;
  try {
    if (!(await providerCapacityAvailable())) { await heartbeat("degraded","healthy",null,"PROVIDER_HOURLY_LIMIT"); return; }
    const { data:messages,error }=await supabase.rpc("claim_email_messages",{p_worker_id:workerId,p_batch_size:config.batchSize});
    if (error) { await heartbeat("degraded",lastHealth.smtpStatus,null,"QUEUE_CLAIM_FAILED",0,1); return; }
    for(const message of messages??[]) { if(shuttingDown) break; await processMessage(message); }
  } finally { processing=false; }
}

const healthServer=http.createServer((request,response)=>{
  if(request.url!=="/health"&&request.url!=="/metrics"){response.writeHead(404);response.end();return;}
  response.writeHead(lastHealth.status==="healthy"?200:503,{"Content-Type":"application/json","Cache-Control":"no-store"});
  response.end(JSON.stringify({service:"picom-email-worker",...lastHealth,workerId:workerId.split(":").slice(0,2).join(":"),queueProcessing:processing}));
});
healthServer.listen(config.healthPort,"127.0.0.1");

const interval=setInterval(()=>void tick(),config.pollMs);
const healthInterval=setInterval(()=>void verifySmtp(),5*60*1000);
await verifySmtp();
void tick();

async function shutdown(signal){if(shuttingDown)return;shuttingDown=true;clearInterval(interval);clearInterval(healthInterval);await heartbeat("stopping",lastHealth.smtpStatus,lastHealth.latencyMs,signal);healthServer.close();transport.close();setTimeout(()=>process.exit(0),250).unref();}
process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=>void shutdown("SIGINT"));

