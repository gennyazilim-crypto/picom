import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { build } from "vite";

const run = process.argv.includes("--run");
const buildOnly = process.argv.includes("--build-only");
const evidencePath = resolve("artifacts/evidence/task-665-hosted-member-voice-screen.json");
const fixtureRoot = resolve("scripts/fixtures/livekit-hosted-e2e");
const rendererOutput = resolve(".tmp/livekit-hosted-e2e");
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const activeLabels = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"];
const deniedLabels = ["VISITOR", "NON_MEMBER", "BANNED"];
const requiredNames = [
  "PICOM_HOSTED_MEDIA_CONFIRM", "PICOM_HOSTED_MEDIA_SUPABASE_URL", "PICOM_HOSTED_MEDIA_SUPABASE_ANON_KEY", "PICOM_HOSTED_MEDIA_ORIGIN",
  "PICOM_HOSTED_MEDIA_COMMUNITY_ID", "PICOM_HOSTED_MEDIA_CHANNEL_ID",
  ...[...activeLabels, ...deniedLabels].flatMap((label) => [`PICOM_HOSTED_MEDIA_${label}_EMAIL`, `PICOM_HOSTED_MEDIA_${label}_PASSWORD`]),
];

const safeMessage = (error) => String(error instanceof Error ? error.message : error).replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]").replace(/(?:https?|wss):\/\/\S+/g, "[redacted-url]").slice(0, 300);

async function buildHarness() {
  await build({
    configFile: false,
    root: fixtureRoot,
    base: "./",
    logLevel: "error",
    build: { outDir: rendererOutput, emptyOutDir: true, minify: true, rollupOptions: { input: resolve(fixtureRoot, "index.html") } },
  });
}

if (!run && !buildOnly) {
  console.log("Hosted member Voice/Screen E2E is BLOCKED until --run and protected STAGING_ONLY credentials are supplied.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log("No network request was made and no credential value was printed.");
  process.exit(0);
}

await buildHarness();
if (buildOnly) {
  await rm(rendererOutput, { recursive: true, force: true });
  console.log("Hosted LiveKit Electron renderer harness build passed without a network request.");
  process.exit(0);
}

const missing = requiredNames.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing hosted media configuration names: ${missing.join(", ")}`);
if (process.env.PICOM_HOSTED_MEDIA_CONFIRM !== "STAGING_ONLY") throw new Error("PICOM_HOSTED_MEDIA_CONFIRM must equal STAGING_ONLY.");
if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_HOSTED_MEDIA_SUPABASE_ANON_KEY)) throw new Error("Use an anon/publishable key, never service-role.");
if (new URL(process.env.PICOM_HOSTED_MEDIA_SUPABASE_URL).protocol !== "https:") throw new Error("Hosted Supabase URL must use HTTPS.");

const sessions = new Map();
let stage = "authentication";
let evidence = {
  schemaVersion: 1,
  task: 665,
  status: "failed",
  environment: "hosted-staging",
  provider: "livekit-cloud",
  runId: process.env.PICOM_HOSTED_MEDIA_RUN_ID ?? "local-manual",
  activeActorClasses: activeLabels.map((label) => label.toLowerCase()),
  deniedActorClasses: ["visitor", "non_member", "banned"],
  containsSecrets: false,
};

async function signIn(label) {
  const client = createClient(process.env.PICOM_HOSTED_MEDIA_SUPABASE_URL, process.env.PICOM_HOSTED_MEDIA_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.signInWithPassword({ email: process.env[`PICOM_HOSTED_MEDIA_${label}_EMAIL`], password: process.env[`PICOM_HOSTED_MEDIA_${label}_PASSWORD`] });
  if (result.error || !result.data.session || !result.data.user) throw new Error(`${label.toLowerCase()} hosted authentication failed.`);
  const session = { client, accessToken: result.data.session.access_token, userId: result.data.user.id };
  sessions.set(label, session);
  return session;
}

async function requestToken(session, intent = "screen") {
  const response = await fetch(`${process.env.PICOM_HOSTED_MEDIA_SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/livekit-token`, {
    method: "POST",
    headers: {
      apikey: process.env.PICOM_HOSTED_MEDIA_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      Origin: process.env.PICOM_HOSTED_MEDIA_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ communityId: process.env.PICOM_HOSTED_MEDIA_COMMUNITY_ID, channelId: process.env.PICOM_HOSTED_MEDIA_CHANNEL_ID, intent }),
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  return { response, payload };
}

async function runElectronHarness(clients) {
  const mainPath = resolve(fixtureRoot, "main.cjs");
  const preloadPath = resolve(fixtureRoot, "preload.cjs");
  const rendererHtml = resolve(rendererOutput, "index.html");
  const command = process.platform === "linux" ? "xvfb-run" : electronPath;
  const args = process.platform === "linux" ? ["-a", electronPath, mainPath] : [mainPath];
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const stdout = [];
  const stderr = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdin.end(JSON.stringify({ clients, rendererHtml, preloadPath }));
  const exitCode = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("Hosted Electron media harness timed out.")); }, 210000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); resolveExit(code ?? 1); });
  });
  const output = stdout.join("");
  const resultLine = output.split(/\r?\n/).find((line) => line.startsWith("PICOM_HOSTED_E2E_RESULT="));
  if (!resultLine) throw new Error(`Hosted Electron harness returned no result (${safeMessage(stderr.join("").slice(-1000))}).`);
  const result = JSON.parse(resultLine.slice("PICOM_HOSTED_E2E_RESULT=".length));
  if (exitCode !== 0 || result.status !== "passed") throw new Error(`Hosted Electron harness failed: ${safeMessage(result.error ?? "unknown failure")}`);
  return result.matrix;
}

try {
  for (const label of [...activeLabels, ...deniedLabels]) await signIn(label);

  stage = "token-authorization";
  const activeTokens = [];
  for (const label of activeLabels) {
    const tokenResult = await requestToken(sessions.get(label));
    if (tokenResult.response.status !== 200 || typeof tokenResult.payload?.token !== "string" || typeof tokenResult.payload?.url !== "string" || typeof tokenResult.payload?.roomName !== "string") throw new Error(`${label.toLowerCase()} did not receive a complete hosted screen token.`);
    if (!tokenResult.payload.canPublishAudio || !tokenResult.payload.canPublishScreen || tokenResult.payload.canPublishVideo === true) throw new Error(`${label.toLowerCase()} received an invalid hosted media grant.`);
    activeTokens.push({ label: label.toLowerCase(), url: tokenResult.payload.url, token: tokenResult.payload.token, expectedRemoteCount: activeLabels.length - 1, roomName: tokenResult.payload.roomName });
  }
  if (new Set(activeTokens.map((entry) => entry.roomName)).size !== 1 || new Set(activeTokens.map((entry) => entry.url)).size !== 1) throw new Error("Active actors did not receive one deterministic hosted room/provider target.");

  for (const label of deniedLabels) {
    const denied = await requestToken(sessions.get(label), "voice");
    if (denied.response.status !== 403) throw new Error(`${label.toLowerCase()} expected hosted denial but received ${denied.response.status}.`);
  }

  stage = "moderation-hierarchy";
  const moderationCases = [["OWNER", "ADMIN", true], ["ADMIN", "MODERATOR", true], ["MODERATOR", "MEMBER", true], ["MEMBER", "MODERATOR", false]];
  for (const [actorLabel, targetLabel, allowed] of moderationCases) {
    const actor = sessions.get(actorLabel);
    const target = sessions.get(targetLabel);
    const result = await actor.client.rpc("authorize_livekit_voice_moderation", { target_community_id: process.env.PICOM_HOSTED_MEDIA_COMMUNITY_ID, target_channel_id: process.env.PICOM_HOSTED_MEDIA_CHANNEL_ID, target_user_id: target.userId, target_action: "remove" });
    if (allowed && result.error) throw new Error(`${actorLabel.toLowerCase()} expected moderation authorization.`);
    if (!allowed && !result.error) throw new Error(`${actorLabel.toLowerCase()} unexpectedly received higher-role moderation authorization.`);
  }

  stage = "hosted-media";
  const matrix = await runElectronHarness(activeTokens.map(({ roomName: _roomName, ...client }) => client));
  const mediaRows = matrix.media ?? [];
  const cleanupRows = matrix.cleanup ?? [];
  const controlsRows = matrix.controls ?? [];
  if (matrix.connected?.length !== activeLabels.length || !matrix.connected.every((entry) => entry.connected)) throw new Error("Not every active role joined the hosted room.");
  if (matrix.published?.length !== activeLabels.length || !matrix.published.every((entry) => entry.microphonePublished && entry.screenPublished)) throw new Error("Not every active role published microphone and screen tracks.");
  if (mediaRows.length !== activeLabels.length || !mediaRows.every((entry) => entry.remoteAudioTracks === activeLabels.length - 1 && entry.remoteScreenTracks === activeLabels.length - 1 && entry.renderedScreens >= activeLabels.length - 1 && entry.speakingObserved)) throw new Error("Bidirectional audio, speaking, or remote screen rendering evidence is incomplete.");
  if (controlsRows.length !== activeLabels.length || !controlsRows.every((entry) => entry.remoteMuteEvents >= activeLabels.length - 1 && entry.remoteUnmuteEvents >= activeLabels.length - 1)) throw new Error("Remote mute/unmute propagation evidence is incomplete.");
  if (!matrix.reconnect?.reconnecting || !matrix.reconnect?.reconnected) throw new Error("Hosted reconnect evidence is incomplete.");
  if (cleanupRows.length !== activeLabels.length || !cleanupRows.every((entry) => entry.disconnected && entry.microphoneEnded && entry.screenEnded && entry.attachedElements === 0)) throw new Error("Hosted track or room cleanup evidence is incomplete.");

  evidence = {
    ...evidence,
    status: "passed",
    tokenAuthorization: { activePassed: activeLabels.length, deniedPassed: deniedLabels.length, moderationHierarchyPassed: moderationCases.length },
    media: {
      joinedClients: matrix.connected.length,
      microphonePublishers: matrix.published.length,
      screenPublishers: matrix.published.length,
      simultaneousScreenShares: matrix.published.length,
      remoteAudioReceivers: mediaRows.length,
      remoteScreenRenderers: mediaRows.length,
      speakingIndicatorClients: mediaRows.filter((entry) => entry.speakingObserved).length,
      muteCycleClients: controlsRows.length,
      reconnectPassed: true,
      reconnectMode: matrix.reconnect.mode,
      cleanupPassed: true,
    },
  };
  console.log("Hosted active-member Voice/Screen media matrix passed for Owner, Admin, Moderator, and Member; denial, moderation, RTP, render, mute, reconnect, and cleanup evidence is redacted.");
} catch (error) {
  evidence = { ...evidence, status: "failed", failedStage: stage, error: safeMessage(error) };
  throw error;
} finally {
  await mkdir(resolve("artifacts/evidence"), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await rm(rendererOutput, { recursive: true, force: true });
  for (const session of sessions.values()) await session.client.auth.signOut({ scope: "local" }).catch(() => undefined);
}
