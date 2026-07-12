import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const packageJson = JSON.parse(read("package.json"));
const runner = read("scripts/livekit-local.mjs");
const e2e = read("scripts/livekit-local-e2e.mjs");
const template = read("infra/livekit/local/livekit.template.yaml");
const rendererEnv = read("infra/livekit/local/renderer.env.example");
const docs = read("docs/local-self-hosted-livekit.md");

const checks = [
  ["pinned LiveKit image digest", runner.includes("livekit/livekit-server@sha256:2c6869d2d5ff6c9c0166f47be1c92dad6928bfecfa5e4060a6ece48db8accfa3")],
  ["official native archive hashes", runner.includes("57afee4cdb044e5fda04c2cc00ca30f4c783bea1f1ea2f483321ce4b9cff4acf") && runner.includes("e9f70e2e44f8fbe1c5ad109087d44964d2afebfccfe0e8282a92215cf332e028")],
  ["native provider avoids Docker Desktop ICE NAT", runner.includes("provisionNativeBinary") && runner.includes('provider: "native"')],
  ["isolated Picom container", runner.includes('const containerName = "picom-livekit-local"')],
  ["runtime secrets stay ignored", runner.includes(".tmp/picom-livekit-local") && runner.includes("PICOM_LOCAL_DEVELOPMENT_ONLY") && runner.includes("doNotPromote: true")],
  ["local and explicit LAN modes", runner.includes('isLan ? "lan" : "loopback"') && runner.includes("--lan-address=") && runner.includes('isLan ? "0.0.0.0" : "127.0.0.1"')],
  ["verified process-only shutdown", runner.includes("nativeProcessMatches") && runner.includes("Refusing to stop an unverified process")],
  ["non-conflicting local ports", runner.includes("17880") && runner.includes("17881") && runner.includes("17882")],
  ["safe lifecycle commands", ["start", "health", "stop", "cleanup"].every((command) => packageJson.scripts[`livekit:local:${command}`])],
  ["no committed credentials", template.includes("__PICOM_LOCAL_API_KEY__") && template.includes("__PICOM_LOCAL_API_SECRET__") && !/devkey|secret:\s*[^_]/i.test(template)],
  ["renderer receives public endpoint only", rendererEnv.includes("VITE_LIVEKIT_URL=ws://127.0.0.1:17880") && !rendererEnv.includes("API_SECRET")],
  ["two-client real provider harness", e2e.includes('["member", "peer"]') && e2e.includes("remoteAudioTracks === 1") && e2e.includes("remoteScreenTracks === 1")],
  ["reconnect and cleanup verified", e2e.includes("reconnectRecovery") && e2e.includes("clientTrackCleanup")],
  ["operator documentation", docs.includes("npm run livekit:local:start") && docs.includes("npm run livekit:local:e2e") && docs.includes("npm run livekit:local:cleanup")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Local self-hosted LiveKit development contract passed.");
