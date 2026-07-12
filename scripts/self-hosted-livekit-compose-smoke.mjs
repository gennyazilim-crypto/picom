import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const compose = read("infra/livekit/compose/compose.yaml");
const livekit = read("infra/livekit/compose/livekit.staging.template.yaml");
const redis = read("infra/livekit/compose/redis.staging.template.conf");
const generate = read("infra/livekit/compose/generate-staging-secrets.sh");
const deploy = read("infra/livekit/compose/deploy-staging.sh");
const status = read("infra/livekit/compose/status-staging.sh");
const stop = read("infra/livekit/compose/stop-staging.sh");
const rollback = read("infra/livekit/compose/rollback-staging.sh");
const docs = read("docs/self-hosted-livekit-compose.md");

const checks = [
  ["pinned LiveKit digest", compose.includes("livekit/livekit-server:v1.13.1@sha256:2c6869d2d5ff6c9c0166f47be1c92dad6928bfecfa5e4060a6ece48db8accfa3")],
  ["pinned Redis digest", compose.includes("redis:7.4.9-alpine@sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99")],
  ["host networking without port publications", (compose.match(/network_mode: host/g) ?? []).length === 2 && !compose.includes("ports:")],
  ["secret files not Compose values", compose.includes("PICOM_LIVEKIT_SECRET_DIR") && compose.includes("/livekit.yaml") && compose.includes("/redis.conf") && !compose.includes("LIVEKIT_API_SECRET=")],
  ["Redis loopback and authentication", redis.includes("bind 127.0.0.1") && redis.includes("requirepass __REDIS_PASSWORD__") && livekit.includes("address: 127.0.0.1:__REDIS_PORT__")],
  ["signal internal and metrics defined", livekit.includes("port: __SIGNAL_PORT__") && livekit.includes("prometheus_port: __METRICS_PORT__")],
  ["TURN explicitly deferred", livekit.includes("turn:") && livekit.includes("enabled: false")],
  ["health and graceful shutdown", compose.includes("healthcheck:") && compose.includes("list-nodes") && compose.includes("stop_grace_period: 60s")],
  ["resource and hardening controls", compose.includes("no-new-privileges:true") && compose.includes('cpus: "3.0"') && compose.includes("read_only: true")],
  ["strong runtime-only secret generation", generate.includes("openssl rand -hex 32") && generate.includes("-m 0640") && generate.includes("STAGING_ONLY")],
  ["default-deny deploy preflight", deploy.includes("UFW incoming default must be deny") && deploy.includes("config --quiet") && deploy.includes("--wait")],
  ["Redis, API, metrics, log checks", status.includes("redis-cli") && status.includes("127.0.0.1:7880") && status.includes("127.0.0.1:6789/metrics") && status.includes("error_count")],
  ["non-destructive stop and rollback", stop.includes("down --timeout 60") && !stop.includes("--volumes") && rollback.includes("Secret files and Redis data were preserved")],
  ["truthful staging blocker", docs.includes("BLOCKED_PENDING_REAL_STAGING_HOST")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted LiveKit Redis/Compose staging contract passed.");
