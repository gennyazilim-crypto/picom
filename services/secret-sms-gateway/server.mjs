import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const host = process.env.PICOM_SMS_GATEWAY_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.PICOM_SMS_GATEWAY_PORT || "8788");
const sharedSecret = process.env.PICOM_SMS_GATEWAY_SHARED_SECRET?.trim() || "";
const kannelUrl = process.env.KANNEL_SEND_URL?.trim() || "http://127.0.0.1:13013/cgi-bin/sendsms";
const kannelUsername = process.env.KANNEL_USERNAME?.trim() || "";
const kannelPassword = process.env.KANNEL_PASSWORD?.trim() || "";
const sender = process.env.KANNEL_FROM?.trim() || "Picom";
const transportReady = process.env.PICOM_SMS_TRANSPORT_READY === "true";
const maximumBodyBytes = 16 * 1024;
const signatureWindowSeconds = 90;
const usedNonces = new Map();

if (sharedSecret.length < 32) throw new Error("PICOM_SMS_GATEWAY_SHARED_SECRET must contain at least 32 characters.");
if (!kannelUsername || !kannelPassword) throw new Error("Kannel credentials are required.");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PICOM_SMS_GATEWAY_PORT is invalid.");

const target = new URL(kannelUrl);
const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!new Set(["http:", "https:"]).has(target.protocol)) throw new Error("KANNEL_SEND_URL must use HTTP or HTTPS.");
if (target.protocol === "http:" && !loopback.has(target.hostname)) throw new Error("Plain HTTP Kannel transport is allowed only on loopback.");

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
function safeSignature(value) {
  if (!value?.startsWith("sha256=")) return null;
  const hex = value.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, "hex");
}
function authorized(headers, rawBody) {
  const timestampValue = headers["x-picom-timestamp"];
  const nonce = headers["x-picom-nonce"];
  const supplied = safeSignature(headers["x-picom-signature"]);
  if (typeof timestampValue !== "string" || typeof nonce !== "string" || !supplied || !/^[0-9a-f-]{36}$/i.test(nonce)) return false;
  const timestamp = Number(timestampValue);
  if (!Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > signatureWindowSeconds) return false;
  const prior = usedNonces.get(nonce);
  if (prior && prior > Date.now()) return false;
  const expected = createHmac("sha256", sharedSecret).update(`${timestampValue}.${nonce}.${rawBody}`).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  usedNonces.set(nonce, Date.now() + signatureWindowSeconds * 1000);
  for (const [key, expiry] of usedNonces) if (expiry <= Date.now()) usedNonces.delete(key);
  return true;
}
function validPayload(value) {
  if (!value || typeof value !== "object") return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId || "")) return false;
  if (!/^\+[1-9][0-9]{7,14}$/.test(value.phone || "") || !/^[0-9]{6}$/.test(value.code || "")) return false;
  const expiry = Date.parse(value.expiresAt || "");
  return Number.isFinite(expiry) && expiry > Date.now() && expiry <= Date.now() + 10 * 60 * 1000;
}
async function sendSms(payload) {
  if (!transportReady) throw new Error("SMS transport is not certified ready.");
  const form = new URLSearchParams({
    username: kannelUsername,
    password: kannelPassword,
    to: payload.phone,
    from: sender,
    text: `Picom verification code: ${payload.code}. It expires in 5 minutes. Do not share this code.`,
    coding: "0",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form, signal: controller.signal });
    const result = (await response.text()).slice(0, 256);
    if (!response.ok || !/^0:\s*/.test(result)) throw new Error("Kannel rejected the message.");
  } finally { clearTimeout(timer); }
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") return sendJson(response, 200, { ok: true, transport: "kannel", transportReady });
  if (request.method !== "POST" || request.url !== "/v1/messages/send") return sendJson(response, 404, { ok: false });
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > maximumBodyBytes) request.destroy(new Error("payload too large"));
    else chunks.push(chunk);
  });
  request.on("error", () => { if (!response.headersSent) sendJson(response, 413, { ok: false }); });
  request.on("end", async () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    if (!authorized(request.headers, rawBody)) return sendJson(response, 401, { ok: false });
    let payload;
    try { payload = JSON.parse(rawBody); } catch { return sendJson(response, 400, { ok: false }); }
    if (!validPayload(payload)) return sendJson(response, 400, { ok: false });
    try {
      await sendSms(payload);
      console.log(JSON.stringify({ event: "sms_queued", requestId: payload.requestId }));
      return sendJson(response, 202, { ok: true, requestId: payload.requestId });
    } catch {
      console.error(JSON.stringify({ event: "sms_transport_failed", requestId: payload.requestId }));
      return sendJson(response, 503, { ok: false });
    }
  });
});

server.listen(port, host, () => console.log(JSON.stringify({ event: "gateway_ready", host, port })));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));