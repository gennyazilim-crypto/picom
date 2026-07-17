import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const edge=read("supabase/functions/secret-community-verification/index.ts");
const migration=read("supabase/migrations/20260717233000_self_hosted_secret_sms_verification.sql");
const gateway=read("services/secret-sms-gateway/server.mjs");
const service=read("services/secret-sms-gateway/systemd/picom-secret-sms-gateway.service");
const docs=read("docs/self-hosted-secret-sms-verification.md");
const flow=read("src/components/SecretCommunityFlows.tsx");
const checks=[
  ["Twilio removed from SMS runtime",!/TWILIO_|verify\.twilio\.com/i.test(edge+gateway)],
  ["call transport removed from active function",!edge.includes("PICOM_VOICE_VERIFY")&&!edge.includes("/v1/calls/start")],
  ["self-hosted SMS gateway secrets",edge.includes("PICOM_SMS_VERIFY_BASE_URL")&&edge.includes("PICOM_SMS_VERIFY_SHARED_SECRET")],
  ["signed gateway requests",edge.includes("x-picom-signature")&&edge.includes("x-picom-nonce")&&edge.includes("x-picom-timestamp")],
  ["short-lived hash-only SMS challenge",migration.includes("secret_phone_sms_challenges")&&migration.includes("code_hash")&&!migration.includes("raw_phone")],
  ["service-role-only SMS RPCs",migration.includes("SERVICE_ROLE_REQUIRED")&&migration.includes("verify_secret_phone_sms_challenge")],
  ["self-hosted SMS provider",migration.includes("picom_self_hosted_sms_v1")],
  ["old voice RPC disabled",migration.includes("revoke execute on function public.verify_secret_phone_voice_challenge")],
  ["gateway constant-time signature",gateway.includes("timingSafeEqual")&&gateway.includes("createHmac")],
  ["gateway replay protection",gateway.includes("usedNonces")&&gateway.includes("signatureWindowSeconds")],
  ["gateway payload limit",gateway.includes("maximumBodyBytes")],
  ["Kannel transport",gateway.includes("KANNEL_SEND_URL")&&gateway.includes("/cgi-bin/sendsms")],
  ["transport readiness fails closed",gateway.includes("PICOM_SMS_TRANSPORT_READY")&&gateway.includes("SMS transport is not certified ready")],
  ["loopback defaults",gateway.includes('"127.0.0.1"')&&gateway.includes("loopback")],
  ["hardened systemd unit",service.includes("NoNewPrivileges=true")&&service.includes("ProtectSystem=strict")],
  ["SMS user experience",flow.includes("Send SMS code")&&flow.includes("Code from the SMS")&&!flow.includes("Call me with a code")],
  ["physical transport documented",/GSM modem, SIM, or SMPP/i.test(docs)],
];
for(const[label,passed]of checks){assert.equal(passed,true,label);console.log(`PASS ${label}`)}
console.log("Picom self-hosted secret SMS verification contract completed.");