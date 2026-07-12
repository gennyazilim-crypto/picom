import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { build } from "vite";

const run = process.argv.includes("--run");
const runtimeDir = resolve(".tmp/picom-livekit-local");
const fixtureRoot = resolve("scripts/fixtures/livekit-hosted-e2e");
const rendererOutput = resolve(".tmp/livekit-local-e2e");
const evidencePath = resolve("docs/evidence/task-659-local-self-hosted-livekit.json");
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const resultPrefix = "PICOM_HOSTED_E2E_RESULT=";

const safeMessage = (error) => String(error instanceof Error ? error.message : error)
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]")
  .replace(/(?:https?|wss?):\/\/\S+/g, "[redacted-url]")
  .slice(0, 300);

function encode(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function createToken({ apiKey, apiSecret, identity, name, room }) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: apiKey,
    sub: identity,
    name,
    nbf: now - 5,
    exp: now + 600,
    jti: randomUUID(),
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ["microphone", "screen_share", "screen_share_audio"],
    },
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac("sha256", apiSecret).update(unsigned).digest("base64url")}`;
}

function isSafeLocalEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "ws:") return false;
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return true;
    const parts = url.hostname.split(".").map(Number);
    return parts.length === 4 && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
  } catch {
    return false;
  }
}

async function runElectronHarness(clients) {
  if (process.platform === "linux" && !process.env.DISPLAY) throw new Error("Local Linux media validation requires an Xvfb DISPLAY.");
  const child = spawn(electronPath, [resolve(fixtureRoot, "main.cjs")], {
    cwd: process.cwd(),
    env: { ...process.env, PICOM_HOSTED_E2E_CONFIG_FD: "3", ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
    stdio: ["ignore", "pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout = [];
  const stderr = [];
  let configPipeError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdio[3].on("error", (error) => { configPipeError = error; });
  child.stdio[3].end(JSON.stringify({
    clients,
    rendererHtml: resolve(rendererOutput, "index.html"),
    preloadPath: resolve(fixtureRoot, "preload.cjs"),
    nativeCapture: false,
  }));
  const exitCode = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("Local Electron media harness timed out.")); }, 210000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); resolveExit(code ?? 1); });
  });
  const resultLine = stdout.join("").split(/\r?\n/).find((line) => line.startsWith(resultPrefix));
  if (!resultLine) {
    const tail = safeMessage(`${configPipeError?.message ?? ""} ${stderr.join("").slice(-700)} ${stdout.join("").slice(-300)}`.trim());
    throw new Error(`Local Electron media harness returned no result at exit ${exitCode}${tail ? `: ${tail}` : "."}`);
  }
  const result = JSON.parse(resultLine.slice(resultPrefix.length));
  if (exitCode !== 0 || result.status !== "passed") throw new Error(`Local Electron media harness failed: ${safeMessage(result.error ?? "unknown failure")}`);
  return result.matrix;
}

function assertMatrix(matrix) {
  if (!Array.isArray(matrix.connected) || matrix.connected.length !== 2 || !matrix.connected.every((entry) => entry.connected)) throw new Error("Two local clients did not connect.");
  if (!Array.isArray(matrix.published) || !matrix.published.every((entry) => entry.microphonePublished && entry.screenPublished)) throw new Error("Local microphone or screen publication failed.");
  if (!Array.isArray(matrix.media) || !matrix.media.every((entry) => entry.remoteParticipants === 1 && entry.remoteAudioTracks === 1 && entry.remoteScreenTracks === 1 && entry.renderedScreens >= 1 && entry.speakingObserved)) throw new Error("Bidirectional local audio/screen media evidence is incomplete.");
  if (!Array.isArray(matrix.controls) || !matrix.controls.every((entry) => entry.remoteMuteEvents >= 1 && entry.remoteUnmuteEvents >= 1)) throw new Error("Local mute/unmute propagation failed.");
  if (!matrix.reconnect?.reconnected || matrix.postReconnectMedia?.remoteAudioTracks !== 1 || matrix.postReconnectMedia?.remoteScreenTracks !== 1) throw new Error("Local reconnect recovery failed.");
  if (!Array.isArray(matrix.cleanup) || !matrix.cleanup.every((entry) => entry.disconnected && entry.microphoneEnded && entry.screenEnded && entry.attachedElements === 0)) throw new Error("Local client media cleanup failed.");
}

if (!run) {
  console.log("Local self-hosted LiveKit media test is BLOCKED until --run is supplied. No network request was made.");
  process.exit(0);
}

const state = JSON.parse(await readFile(resolve(runtimeDir, "state.json"), "utf8"));
const credentials = JSON.parse(await readFile(resolve(runtimeDir, "credentials.json"), "utf8"));
if (state.environment !== "development" || credentials.scope !== "PICOM_LOCAL_DEVELOPMENT_ONLY" || credentials.doNotPromote !== true) throw new Error("Local development credential boundary is invalid.");
if (!isSafeLocalEndpoint(state.publicUrl)) throw new Error("Local E2E refuses non-private or TLS production endpoints.");
if (typeof credentials.apiKey !== "string" || typeof credentials.apiSecret !== "string" || credentials.apiSecret.length < 32) throw new Error("Local credentials are unavailable.");
const health = await fetch(state.healthUrl, { signal: AbortSignal.timeout(5000) });
if (!health.ok) throw new Error("Local LiveKit health check failed before media validation.");

await build({
  configFile: false,
  root: fixtureRoot,
  base: "./",
  logLevel: "error",
  build: { outDir: rendererOutput, emptyOutDir: true, minify: true, rollupOptions: { input: resolve(fixtureRoot, "index.html") } },
});
const room = `picom-local-${randomUUID()}`;
const clients = ["member", "peer"].map((label) => ({
  label,
  url: state.publicUrl,
  token: createToken({ apiKey: credentials.apiKey, apiSecret: credentials.apiSecret, identity: `local-${label}-${randomUUID()}`, name: `Local ${label}`, room }),
  expectedRemoteCount: 1,
}));
const matrix = await runElectronHarness(clients);
assertMatrix(matrix);

const evidence = {
  task: 659,
  status: "passed",
  provider: "self-hosted-livekit",
  environment: "local-development",
  endpointClass: state.mode === "lan" ? "private-lan" : "loopback",
  livekitVersion: state.version,
  imageDigestPinned: String(state.image).includes("@sha256:"),
  clientCount: 2,
  checks: {
    websocketRoomJoin: true,
    bidirectionalSyntheticMicrophoneAudio: true,
    participantState: true,
    muteUnmutePropagation: true,
    simultaneousScreenPublication: true,
    remoteScreenRendering: true,
    reconnectRecovery: true,
    clientTrackCleanup: true,
  },
  nativePicker: "not_applicable_synthetic_local_harness",
  secretsIncluded: false,
  recordedAt: new Date().toISOString(),
};
await mkdir(resolve("docs/evidence"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log("Local self-hosted LiveKit two-client audio, screen, reconnect, and cleanup validation passed; evidence is redacted.");
