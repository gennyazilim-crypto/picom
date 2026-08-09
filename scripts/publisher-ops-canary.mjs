/**
 * TASK34 bounded production canary — signaling / TLS / public health only.
 * Does NOT certify media, OBS, chat two-client, analytics multi-viewer, or recording.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tls from "node:tls";
import dns from "node:dns/promises";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "voice.picom.gg";
const supabaseHost = "cqnsetsmcduraryemhbi.supabase.co";
const out = [];

function log(line) {
  out.push(line);
  console.log(line);
}

async function dnsLookup(name) {
  try {
    const records = await dns.lookup(name, { all: true });
    return { ok: true, records: records.map((r) => r.address) };
  } catch (error) {
    return { ok: false, error: String(error?.code || error?.message || error) };
  }
}

function tlsProbe(name, port = 443, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: name, port, servername: name, rejectUnauthorized: true }, () => {
      const cert = socket.getPeerCertificate();
      resolve({
        ok: true,
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        validTo: cert?.valid_to || null,
      });
      socket.end();
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS_TIMEOUT" });
    });
    socket.on("error", (error) => resolve({ ok: false, error: String(error?.code || error?.message || error) }));
  });
}

function tcpProbe(name, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: name, port }, () => {
      resolve({ ok: true });
      socket.end();
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ ok: false, error: "TCP_TIMEOUT" });
    });
    socket.on("error", (error) => resolve({ ok: false, error: String(error?.code || error?.message || error) }));
  });
}

async function httpJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" } });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = { raw_len: text.length }; }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, error: String(error?.name || error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

log(`CANARY_STARTED ${new Date().toISOString()}`);
log("LABEL: SIGNALING_CANARY (not media/OBS/chat/analytics/recording)");

const dnsVoice = await dnsLookup(host);
log(`DNS voice.picom.gg: ${dnsVoice.ok ? "OK " + dnsVoice.records.join(",") : "FAIL " + dnsVoice.error}`);

const tlsVoice = await tlsProbe(host);
log(`TLS voice.picom.gg:443: ${tlsVoice.ok ? `OK proto=${tlsVoice.protocol} authorized=${tlsVoice.authorized}` : "FAIL " + tlsVoice.error}`);

const tcp443 = await tcpProbe(host, 443);
log(`TCP voice.picom.gg:443: ${tcp443.ok ? "OK" : "FAIL " + tcp443.error}`);

const dnsSb = await dnsLookup(supabaseHost);
log(`DNS supabase project: ${dnsSb.ok ? "OK" : "FAIL " + dnsSb.error}`);

const healthLive = await httpJson(`https://${supabaseHost}/functions/v1/health/live`);
log(`EDGE health/live: ${healthLive.ok ? "OK status=" + healthLive.status : "FAIL " + (healthLive.error || healthLive.status)}`);

const healthCombined = await httpJson(`https://${supabaseHost}/functions/v1/health`);
const healthStatus = healthCombined.body?.status ?? "unknown";
log(`EDGE health combined status=${healthStatus} (placeholders must not be treated as HEALTHY)`);
if (String(healthStatus).toLowerCase() === "operational" && /placeholder/i.test(JSON.stringify(healthCombined.body || {}))) {
  log("WARN: combined health reported operational with placeholders — treat as UNKNOWN for Task34");
}

log("MEDIA_CANARY: NOT_RUN");
log("OBS_CANARY: NOT_RUN");
log("CHAT_TWO_CLIENT: NOT_RUN");
log("ANALYTICS_MULTI_VIEWER: NOT_RUN");
log("RECORDING: BLOCKED_INFRASTRUCTURE");

const signalingOk = dnsVoice.ok && tlsVoice.ok && tcp443.ok;
log(`SIGNALING_CANARY_RESULT: ${signalingOk ? "PASS_BOUNDED" : "FAIL"}`);
log(`CANARY_FINISHED ${new Date().toISOString()}`);

const evidenceDir = process.env.PICOM_T34_EVIDENCE_DIR;
if (evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, "31-canary.txt"), out.join("\n") + "\n", "utf8");
}

process.exit(signalingOk ? 0 : 2);
