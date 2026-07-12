import { resolve4 } from "node:dns/promises";
import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";

const run = process.argv.includes("--run");
const primary = process.env.PICOM_PRIMARY_HOSTNAME?.trim();
const turn = process.env.PICOM_TURN_HOSTNAME?.trim();
const confirm = process.env.PICOM_EXTERNAL_NETWORK_CONFIRM;

function validHostname(value) {
  return typeof value === "string" && /^(?=.{4,253}$)(?!.*\.invalid$)(?!localhost$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value);
}

function tcp(host, port, timeout = 8000) {
  return new Promise((resolveResult, reject) => {
    const socket = connectTcp({ host, port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error(`TCP ${port} timed out.`)); }, timeout);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolveResult(true); });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

function trustedTls(host, port) {
  return new Promise((resolveResult, reject) => {
    const socket = connectTls({ host, port, servername: host, rejectUnauthorized: true });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error(`TLS ${port} timed out.`)); }, 10000);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      if (!socket.authorized || !certificate.valid_to || Date.parse(certificate.valid_to) < Date.now() + 30 * 86400000) {
        socket.destroy();
        reject(new Error(`TLS ${port} certificate is untrusted or expires within 30 days.`));
        return;
      }
      socket.destroy();
      resolveResult(true);
    });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

if (!run) {
  console.log("External self-hosted network validation is BLOCKED until --run, hostnames, and EXTERNAL_TEST_NETWORK confirmation are supplied.");
  process.exit(0);
}
if (confirm !== "EXTERNAL_TEST_NETWORK" || !validHostname(primary) || !validHostname(turn)) throw new Error("External network confirmation and two valid public hostnames are required.");
const [primaryAddresses, turnAddresses] = await Promise.all([resolve4(primary), resolve4(turn)]);
if (!primaryAddresses.length || !turnAddresses.length) throw new Error("Public DNS A records are unavailable.");
await trustedTls(primary, 443);
await trustedTls(turn, 5349);
await tcp(primary, 7881);
const response = await fetch(`https://${primary}/rtc`, { signal: AbortSignal.timeout(10000), redirect: "manual" });
if (response.status < 400 || response.status >= 500) throw new Error("Unauthenticated WSS/RTC path did not fail closed through trusted TLS.");
console.log("External DNS, trusted TLS, unauthenticated WSS denial, ICE/TCP, and TURN/TLS reachability passed; no token, address, or hostname was printed.");
console.log("Authenticated ICE/UDP, TURN/UDP, TURN/TLS relay media and restricted-network proof remain Task 672 evidence.");
