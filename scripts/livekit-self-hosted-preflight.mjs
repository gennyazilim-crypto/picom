import { resolve4, resolve6 } from "node:dns/promises";
import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";

const timeoutMs = 5_000;
const liveKitValue = (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || "").trim();
const turnDomain = (process.env.PICOM_LIVEKIT_TURN_DOMAIN || "").trim();
const turnTlsPortValue = (process.env.PICOM_LIVEKIT_TURN_TLS_PORT || "5349").trim();
const turnTlsPort = Number.parseInt(turnTlsPortValue, 10);
const report = { status: "blocked", deployment: "self_hosted", checks: [], manualChecks: ["UDP 3478 reachability", "UDP 50000-60000 media range", "two-client audio", "remote screen share"] };

function check(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) process.exitCode = 1;
}

async function dnsCheck(hostname) {
  const [v4, v6] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const count = (v4.status === "fulfilled" ? v4.value.length : 0) + (v6.status === "fulfilled" ? v6.value.length : 0);
  if (!count) throw new Error("DNS did not return an address");
  return `${count} address record(s)`;
}

function tcpCheck(hostname, port) {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({ host: hostname, port });
    const finish = (error) => { socket.destroy(); error ? reject(error) : resolve(); };
    socket.setTimeout(timeoutMs, () => finish(new Error("connection timed out")));
    socket.once("connect", () => finish());
    socket.once("error", finish);
  });
}

function tlsCheck(hostname, port) {
  return new Promise((resolve, reject) => {
    const socket = connectTls({ host: hostname, port, servername: hostname, rejectUnauthorized: true });
    const finish = (error) => { socket.destroy(); error ? reject(error) : resolve(); };
    socket.setTimeout(timeoutMs, () => finish(new Error("TLS timed out")));
    socket.once("secureConnect", () => finish(socket.authorized ? undefined : new Error(socket.authorizationError || "TLS is not trusted")));
    socket.once("error", finish);
  });
}

if (!liveKitValue) {
  check("LIVEKIT_URL", false, "Set LIVEKIT_URL or VITE_LIVEKIT_URL to the public wss:// endpoint.");
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

let liveKitUrl;
try { liveKitUrl = new URL(liveKitValue); }
catch { check("LIVEKIT_URL", false, "The URL is invalid."); console.log(JSON.stringify(report, null, 2)); process.exit(1); }

const hostname = liveKitUrl.hostname;
check("secure websocket", liveKitUrl.protocol === "wss:", "Production LiveKit must use wss://.");
check("self-hosted endpoint", !/(^|\.)livekit\.cloud$/i.test(hostname), "LiveKit Cloud endpoints are rejected by this self-hosted preflight.");
check("TURN domain", Boolean(turnDomain), turnDomain ? "TURN domain supplied." : "Set PICOM_LIVEKIT_TURN_DOMAIN.");
check("TURN TLS port", Number.isInteger(turnTlsPort) && turnTlsPort > 0 && turnTlsPort <= 65_535, "TURN/TLS port must be a valid TCP port.");

try { check("LiveKit DNS", true, await dnsCheck(hostname)); }
catch { check("LiveKit DNS", false, "LiveKit hostname does not resolve."); }

try { await tlsCheck(hostname, 443); check("LiveKit TLS 443", true, "Trusted certificate and TCP connection available."); }
catch { check("LiveKit TLS 443", false, "Trusted TLS connection failed."); }

try { await tcpCheck(hostname, 7881); check("WebRTC TCP 7881", true, "Fallback media TCP port is reachable."); }
catch { check("WebRTC TCP 7881", false, "Port 7881 is not reachable."); }

if (turnDomain) {
  try { check("TURN DNS", true, await dnsCheck(turnDomain)); }
  catch { check("TURN DNS", false, "TURN hostname does not resolve."); }
  if (Number.isInteger(turnTlsPort) && turnTlsPort > 0 && turnTlsPort <= 65_535) {
    try { await tlsCheck(turnDomain, turnTlsPort); check(`TURN TLS ${turnTlsPort}`, true, "Trusted TURN/TLS endpoint is reachable."); }
    catch { check(`TURN TLS ${turnTlsPort}`, false, `TURN/TLS port ${turnTlsPort} is not reachable with a trusted certificate.`); }
  }
}

report.status = report.checks.every((item) => item.ok) ? "network_preflight_passed" : "blocked";
console.log(JSON.stringify(report, null, 2));
