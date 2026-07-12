import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const env = read("infra/livekit/network/network.env.example");
const caddy = read("infra/livekit/network/Caddyfile");
const configure = read("infra/livekit/network/configure-networking.sh");
const sync = read("infra/livekit/network/sync-turn-certificate.sh");
const firewall = read("infra/livekit/network/verify-firewall.sh");
const external = read("scripts/self-hosted-livekit-external-connectivity.mjs");
const compose = read("infra/livekit/compose/compose.yaml");
const docs = read("docs/self-hosted-livekit-networking.md");

const checks = [
  ["separate primary and TURN hostnames", env.includes("PICOM_PRIMARY_HOSTNAME") && env.includes("PICOM_TURN_HOSTNAME") && configure.includes('PICOM_PRIMARY_HOSTNAME" != "$PICOM_TURN_HOSTNAME')],
  ["exact Caddy package pin", env.includes("PICOM_CADDY_VERSION=REPLACE") && configure.includes('caddy=${PICOM_CADDY_VERSION}') && configure.includes("apt-mark hold caddy")],
  ["Caddy trusted WSS proxy", caddy.includes("reverse_proxy 127.0.0.1:7880") && caddy.includes("Strict-Transport-Security") && caddy.includes("Authorization delete")],
  ["Caddy automatic TURN certificate subject", caddy.includes("{$PICOM_TURN_HOSTNAME}") && caddy.includes("respond /health 204")],
  ["TURN certificate validation and strict copy", sync.includes("-checkhost") && sync.includes("-checkend 2592000") && sync.includes("-m 0640")],
  ["LiveKit TLS mount", compose.includes("/run/picom-tls:ro")],
  ["reviewed firewall allow matrix", ["80/tcp", "443/tcp", "7881/tcp", "3478/udp", "5349/tcp", "50000:60000/udp"].every((term) => configure.includes(term))],
  ["internal ports explicitly denied", ["7880/tcp", "6379/tcp", "6789/tcp"].every((term) => configure.includes(term))],
  ["no UDP mux mixed with range", !configure.includes("7882/udp") && env.includes("PICOM_RTC_UDP_START=50000") && env.includes("PICOM_RTC_UDP_END=60000")],
  ["host-network Compose verification", firewall.includes("network_mode: host") && firewall.includes("published:")],
  ["tokenless external checks", external.includes("rejectUnauthorized: true") && external.includes("Unauthenticated WSS/RTC") && !external.includes("Authorization:")],
  ["truthful TURN 443 limitation", docs.includes("TCP-443-only") && docs.includes("BLOCKED_PENDING_REAL_DNS_TLS_TURN_FIREWALL")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted LiveKit DNS/TLS/TURN/firewall contract passed.");
