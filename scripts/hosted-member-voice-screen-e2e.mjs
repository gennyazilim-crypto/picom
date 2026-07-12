import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { build } from "vite";

const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const run = process.argv.includes("--run");
const buildOnly = process.argv.includes("--build-only");
const evidencePath = resolve("artifacts/evidence/task-665-hosted-member-voice-screen.json");
const fixtureRoot = resolve("scripts/fixtures/livekit-hosted-e2e");
const rendererOutput = resolve(".tmp/livekit-hosted-e2e");
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const activeLabels = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"];
const deniedLabels = ["VISITOR", "NON_MEMBER", "BANNED"];
const actorLabels = [...activeLabels, ...deniedLabels];
const actorCodes = { OWNER: "ow", ADMIN: "ad", MODERATOR: "mo", MEMBER: "me", VISITOR: "vi", NON_MEMBER: "nm", BANNED: "ba" };
const requiredNames = ["PICOM_HOSTED_MEDIA_CONFIRM", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "PICOM_HOSTED_MEDIA_PROJECT_REF", "PICOM_HOSTED_MEDIA_ORIGIN"];

const safeMessage = (error) => String(error instanceof Error ? error.message : error)
  .replace(/sbp_[A-Za-z0-9_-]+/g, "[redacted-supabase-token]")
  .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-supabase-key]")
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-jwt]")
  .replace(/(?:https?|wss):\/\/\S+/g, "[redacted-url]")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
  .replace(/[A-Za-z0-9._%+-]+@example\.com/g, "[redacted-fixture-email]")
  .slice(0, 300);

async function buildHarness() {
  await build({ configFile: false, root: fixtureRoot, base: "./", logLevel: "error", build: { outDir: rendererOutput, emptyOutDir: true, minify: true, rollupOptions: { input: resolve(fixtureRoot, "index.html") } } });
}

if (!run && !buildOnly) {
  console.log("Hosted member Voice/Screen E2E is BLOCKED until --run and protected STAGING_ONLY management access are supplied.");
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

const createdUsers = [];
const actors = new Map();
const sessions = new Map();
let communityId = null;
let admin = null;
let query = null;
let stage = "configuration";
let failure = null;
let fixtureCleanupPassed = true;
let evidence = {
  schemaVersion: 1,
  task: 665,
  status: "failed",
  environment: "hosted-staging",
  provider: "livekit-cloud",
  runId: process.env.PICOM_HOSTED_MEDIA_RUN_ID ?? "local-manual",
  activeActorClasses: activeLabels.map((label) => label.toLowerCase()),
  deniedActorClasses: ["visitor", "non_member", "banned"],
  fixture: "ephemeral-managed-cleanup",
  containsSecrets: false,
};

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Management API request failed (${response.status}): ${safeMessage(text)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

const keyValue = (record) => typeof record?.api_key === "string" ? record.api_key : typeof record?.value === "string" ? record.value : null;
const keyName = (record) => String(record?.name ?? record?.type ?? "").toLowerCase();
const safeDatabaseError = (error) => safeMessage([error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" | "));

async function signIn(label, baseUrl, publicKey) {
  const actor = actors.get(label);
  const client = createClient(baseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (result.error || !result.data.session || !result.data.user) throw new Error(`${label.toLowerCase()} hosted fixture authentication failed.`);
  const session = { client, accessToken: result.data.session.access_token, userId: result.data.user.id };
  sessions.set(label, session);
  return session;
}

async function requestToken(session, baseUrl, publicKey, community, channel, intent = "screen") {
  const response = await fetch(`${baseUrl}/functions/v1/livekit-token`, {
    method: "POST",
    headers: { apikey: publicKey, Authorization: `Bearer ${session.accessToken}`, Origin: process.env.PICOM_HOSTED_MEDIA_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ communityId: community, channelId: channel, intent }),
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
  if (process.platform === "linux" && !process.env.DISPLAY) throw new Error("Hosted Linux media validation requires an Xvfb DISPLAY.");
  const child = spawn(electronPath, [mainPath], { cwd: process.cwd(), env: { ...process.env, PICOM_HOSTED_E2E_CONFIG_FD: "3" }, stdio: ["ignore", "pipe", "pipe", "pipe"], windowsHide: true });
  const stdout = [];
  const stderr = [];
  let configPipeError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdio[3].on("error", (error) => { configPipeError = error; });
  child.stdio[3].end(JSON.stringify({ clients, rendererHtml, preloadPath }));
  const exitCode = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("Hosted Electron media harness timed out.")); }, 210000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); resolveExit(code ?? 1); });
  });
  const resultLine = stdout.join("").split(/\r?\n/).find((line) => line.startsWith("PICOM_HOSTED_E2E_RESULT="));
  if (!resultLine) {
    const runtimeTail = safeMessage(`${configPipeError?.message ?? ""} ${stderr.join("").slice(-700)} ${stdout.join("").slice(-300)}`.trim());
    throw new Error(`Hosted Electron harness returned no result at exit ${exitCode}${runtimeTail ? `: ${runtimeTail}` : "."}`);
  }
  const result = JSON.parse(resultLine.slice("PICOM_HOSTED_E2E_RESULT=".length));
  if (exitCode !== 0 || result.status !== "passed") throw new Error(`Hosted Electron harness failed: ${safeMessage(result.error ?? "unknown failure")}`);
  return result.matrix;
}

try {
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing hosted media configuration names: ${missing.join(", ")}`);
  if (process.env.PICOM_HOSTED_MEDIA_CONFIRM !== "STAGING_ONLY") throw new Error("PICOM_HOSTED_MEDIA_CONFIRM must equal STAGING_ONLY.");
  if (process.env.SUPABASE_PROJECT_REF !== approvedProjectRef || process.env.PICOM_HOSTED_MEDIA_PROJECT_REF !== approvedProjectRef) throw new Error("Hosted media fixture is restricted to the approved Picom staging project.");

  stage = "ephemeral-fixture";
  const keys = await management(`/projects/${approvedProjectRef}/api-keys?reveal=true`);
  const rows = Array.isArray(keys) ? keys : [];
  const publicRecord = rows.find((item) => /(^|[^a-z])(anon|publishable)([^a-z]|$)/.test(keyName(item))) ?? rows.find((item) => keyName(item).includes("publishable"));
  const secretRecord = rows.find((item) => /service.?role/.test(keyName(item))) ?? rows.find((item) => keyName(item).includes("secret"));
  const publicKey = keyValue(publicRecord);
  const serviceKey = keyValue(secretRecord);
  if (!publicKey || !serviceKey) throw new Error("Protected staging keys could not be resolved through the Management API.");
  const baseUrl = `https://${approvedProjectRef}.supabase.co`;
  admin = createClient(baseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  query = (sql, parameters = [], readOnly = false) => management(`/projects/${approvedProjectRef}/database/query`, { method: "POST", body: JSON.stringify({ query: sql, parameters, read_only: readOnly }) });

  const runTag = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  for (const label of actorLabels) {
    const email = `picom-task665-${runTag}-${label.toLowerCase().replaceAll("_", "-")}@example.com`;
    const password = `P!c0m-${randomBytes(18).toString("base64url")}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Task 665 ${label.toLowerCase()}` } });
    if (created.error || !created.data.user) throw new Error(`Could not create the ${label.toLowerCase()} synthetic staging identity.`);
    createdUsers.push(created.data.user.id);
    actors.set(label, { id: created.data.user.id, email, password });
  }

  communityId = randomUUID();
  const channelId = randomUUID();
  const roleIds = { OWNER: randomUUID(), ADMIN: randomUUID(), MODERATOR: randomUUID(), MEMBER: randomUUID() };
  const profileValues = actorLabels.map((label) => `('${actors.get(label).id}','t665${runTag}${actorCodes[label]}','Task 665 ${label.toLowerCase()}','online','Hosted media fixture')`).join(",\n");
  const membershipValues = [["OWNER", roleIds.OWNER], ["ADMIN", roleIds.ADMIN], ["MODERATOR", roleIds.MODERATOR], ["MEMBER", roleIds.MEMBER], ["BANNED", roleIds.MEMBER]].map(([label, roleId]) => `('${communityId}','${actors.get(label).id}','${roleId}')`).join(",\n");
  await query(`
begin;
insert into public.profiles(id,username,display_name,status,status_text) values
${profileValues}
on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,status=excluded.status,status_text=excluded.status_text,deletion_requested_at=null,is_bot=false;
insert into public.communities(id,owner_id,name,description,kind,visibility,public_read_enabled,type_settings)
values('${communityId}','${actors.get("OWNER").id}','Task 665 Hosted Media','Ephemeral protected media fixture','text','private',false,'{"voiceRoomsEnabled":true}'::jsonb);
insert into public.roles(id,community_id,name,level,permissions,system_key,is_default) values
('${roleIds.OWNER}','${communityId}','Owner',100,'{}'::jsonb,'owner',false),
('${roleIds.ADMIN}','${communityId}','Admin',80,'{}'::jsonb,'admin',false),
('${roleIds.MODERATOR}','${communityId}','Moderator',60,'{}'::jsonb,'moderator',false),
('${roleIds.MEMBER}','${communityId}','Member',10,'{}'::jsonb,'member',true);
insert into public.community_role_permissions(community_id,role_id,permission_key,allowed) values
('${communityId}','${roleIds.OWNER}','muteMembers',true),
('${communityId}','${roleIds.OWNER}','removeFromVoice',true),
('${communityId}','${roleIds.OWNER}','manageVoiceRoom',true),
('${communityId}','${roleIds.ADMIN}','muteMembers',true),
('${communityId}','${roleIds.ADMIN}','removeFromVoice',true),
('${communityId}','${roleIds.ADMIN}','manageVoiceRoom',true),
('${communityId}','${roleIds.MODERATOR}','muteMembers',true),
('${communityId}','${roleIds.MODERATOR}','removeFromVoice',true)
on conflict(role_id,permission_key) do update set allowed=true;
insert into public.community_members(community_id,user_id,role_id) values
${membershipValues};
insert into public.channels(id,community_id,name,type,is_private,public_read_enabled,position)
values('${channelId}','${communityId}','task-665-hosted-voice','voice',false,true,0);
insert into public.community_bans(community_id,user_id,banned_by,reason,revoked_at)
values('${communityId}','${actors.get("BANNED").id}','${actors.get("OWNER").id}','task-665 synthetic denial',null);
commit;`);

  stage = "authentication";
  for (const label of actorLabels) await signIn(label, baseUrl, publicKey);

  stage = "token-authorization";
  const activeTokens = [];
  for (const label of activeLabels) {
    const tokenResult = await requestToken(sessions.get(label), baseUrl, publicKey, communityId, channelId);
    if (tokenResult.response.status !== 200 || typeof tokenResult.payload?.token !== "string" || typeof tokenResult.payload?.url !== "string" || typeof tokenResult.payload?.roomName !== "string") throw new Error(`${label.toLowerCase()} did not receive a complete hosted screen token.`);
    if (!tokenResult.payload.canPublishAudio || !tokenResult.payload.canPublishScreen || tokenResult.payload.canPublishVideo === true) throw new Error(`${label.toLowerCase()} received an invalid hosted media grant.`);
    activeTokens.push({ label: label.toLowerCase(), url: tokenResult.payload.url, token: tokenResult.payload.token, expectedRemoteCount: activeLabels.length - 1, roomName: tokenResult.payload.roomName });
  }
  if (new Set(activeTokens.map((entry) => entry.roomName)).size !== 1 || new Set(activeTokens.map((entry) => entry.url)).size !== 1) throw new Error("Active actors did not receive one deterministic hosted room/provider target.");
  for (const label of deniedLabels) {
    const denied = await requestToken(sessions.get(label), baseUrl, publicKey, communityId, channelId, "voice");
    if (denied.response.status !== 403) throw new Error(`${label.toLowerCase()} expected hosted denial but received ${denied.response.status}.`);
  }

  stage = "moderation-hierarchy";
  const moderationCases = [["OWNER", "ADMIN", true], ["ADMIN", "MODERATOR", true], ["MODERATOR", "MEMBER", true], ["MEMBER", "MODERATOR", false]];
  for (const [actorLabel, targetLabel, allowed] of moderationCases) {
    const actor = sessions.get(actorLabel);
    const target = sessions.get(targetLabel);
    const result = await actor.client.rpc("authorize_livekit_voice_moderation", { target_community_id: communityId, target_channel_id: channelId, target_user_id: target.userId, target_action: "remove" });
    if (allowed && result.error) throw new Error(`${actorLabel.toLowerCase()} expected moderation authorization: ${safeDatabaseError(result.error)}`);
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
  failure = error;
  evidence = { ...evidence, status: "failed", failedStage: stage, error: safeMessage(error) };
} finally {
  for (const session of sessions.values()) await session.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (communityId && query) {
    try { await query("delete from public.communities where id=$1::uuid", [communityId]); } catch { fixtureCleanupPassed = false; }
  }
  if (admin) {
    for (const userId of createdUsers.reverse()) {
      try { const deleted = await admin.auth.admin.deleteUser(userId); if (deleted.error) fixtureCleanupPassed = false; } catch { fixtureCleanupPassed = false; }
    }
  }
  if (!fixtureCleanupPassed) {
    evidence = { ...evidence, status: "failed", fixtureCleanupPassed: false, error: evidence.error ?? "Ephemeral hosted fixture cleanup failed." };
    failure ??= new Error("Ephemeral hosted fixture cleanup failed.");
  } else {
    evidence = { ...evidence, fixtureCleanupPassed: true };
  }
  await mkdir(resolve("artifacts/evidence"), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await rm(rendererOutput, { recursive: true, force: true });
}

if (failure) throw new Error(safeMessage(failure));
