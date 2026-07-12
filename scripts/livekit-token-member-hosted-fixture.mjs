import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const evidencePath = "artifacts/evidence/task-661-livekit-token-staging.json";
const allowedOrigin = "http://127.0.0.1:5173";
const actorLabels = ["owner", "admin", "moderator", "member", "roleless_member", "visitor", "non_member", "banned", "rate_limit"];
const actorCodes = { owner: "ow", admin: "ad", moderator: "mo", member: "me", roleless_member: "rl", visitor: "vi", non_member: "nm", banned: "ba", rate_limit: "rt" };
const activeLabels = ["owner", "admin", "moderator", "member", "roleless_member"];
const deniedLabels = ["visitor", "non_member", "banned"];
const createdUsers = [];
let communityId = null;

const redact = (value) => String(value ?? "")
  .replace(/sbp_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_PAT]")
  .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]")
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED_JWT]")
  .replace(/[A-Za-z0-9._%+-]+@example\.com/g, "[REDACTED_FIXTURE_EMAIL]")
  .slice(0, 1200);

function writeEvidence(patch) {
  mkdirSync("artifacts/evidence", { recursive: true });
  let current = {};
  try { current = JSON.parse(readFileSync(evidencePath, "utf8")); } catch {}
  writeFileSync(evidencePath, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, "utf8");
}

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Management API request failed (${response.status}): ${redact(text)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

const query = (sql, parameters = [], readOnly = false) => management(`/projects/${approvedProjectRef}/database/query`, {
  method: "POST",
  body: JSON.stringify({ query: sql, parameters, read_only: readOnly }),
});

const keyValue = (record) => typeof record?.api_key === "string" ? record.api_key : typeof record?.value === "string" ? record.value : null;
const keyName = (record) => String(record?.name ?? record?.type ?? "").toLowerCase();

function decodeJwt(token) {
  const part = token.split(".")[1];
  if (!part) throw new Error("Hosted token is not a JWT.");
  const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function assertToken(payload, userId, intent) {
  if (!payload?.token || !payload?.roomName || payload.identity !== userId) throw new Error(`${intent} response is incomplete or has the wrong identity.`);
  if ("apiKey" in payload || "apiSecret" in payload || "LIVEKIT_API_SECRET" in payload) throw new Error("Provider credential field reached the response.");
  const claims = decodeJwt(payload.token);
  const sources = claims.video?.canPublishSources ?? [];
  if (claims.sub !== userId || claims.video?.room !== payload.roomName || claims.video?.canSubscribe !== true || claims.video?.canPublishData !== false) throw new Error(`${intent} token identity, room, subscribe, or data grant is invalid.`);
  if (!Number.isFinite(claims.exp) || !Number.isFinite(claims.nbf) || claims.exp - claims.nbf < 540 || claims.exp - claims.nbf > 660) throw new Error(`${intent} token TTL is outside the 600-second contract.`);
  if (sources.includes("camera")) throw new Error(`${intent} token unexpectedly grants camera publication.`);
  if (intent === "voice" && (!sources.includes("microphone") || sources.includes("screen_share"))) throw new Error("Voice token source grants are invalid.");
  if (intent === "screen" && (!sources.includes("microphone") || !sources.includes("screen_share") || !sources.includes("screen_share_audio"))) throw new Error("Screen token source grants are incomplete.");
}

const safeResponseCode = (payload) => typeof payload?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(payload.code) ? payload.code : "NO_SAFE_CODE";
const safeDatabaseCode = (error) => typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "NO_DB_CODE";

const requestFunction = async ({ publicKey, accessToken, body, method = "POST", origin = allowedOrigin, rawBody }) => {
  const response = await fetch(`https://${approvedProjectRef}.supabase.co/functions/v1/livekit-token`, {
    method,
    headers: {
      apikey: publicKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? rawBody ?? JSON.stringify(body ?? {}) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  return { response, payload };
};

if (process.env.PICOM_CONFIRM_LIVEKIT_HOSTED_FIXTURE !== "STAGING_ONLY") throw new Error("Hosted fixture requires PICOM_CONFIRM_LIVEKIT_HOSTED_FIXTURE=STAGING_ONLY.");
if (process.env.SUPABASE_PROJECT_REF !== approvedProjectRef || process.env.PICOM_LIVEKIT_STAGING_PROJECT_REF !== approvedProjectRef) throw new Error("Hosted fixture is restricted to the approved Picom staging project.");
if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) throw new Error("Protected Supabase access is unavailable.");

const runTag = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const keys = await management(`/projects/${approvedProjectRef}/api-keys?reveal=true`);
const keyRows = Array.isArray(keys) ? keys : [];
const publicRecord = keyRows.find((item) => /(^|[^a-z])(anon|publishable)([^a-z]|$)/.test(keyName(item))) ?? keyRows.find((item) => keyName(item).includes("publishable"));
const secretRecord = keyRows.find((item) => /service.?role/.test(keyName(item))) ?? keyRows.find((item) => keyName(item).includes("secret"));
const publicKey = keyValue(publicRecord);
const serviceKey = keyValue(secretRecord);
if (!publicKey || !serviceKey) throw new Error("Staging publishable/anon and server-side administration keys could not be resolved through the protected Management API.");

const admin = createClient(`https://${approvedProjectRef}.supabase.co`, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const actors = new Map();

try {
  for (const label of actorLabels) {
    const email = `picom-task661-${runTag}-${label.replaceAll("_", "-")}@example.com`;
    const password = `P!c0m-${randomBytes(18).toString("base64url")}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Task 661 ${label}` } });
    if (created.error || !created.data.user) throw new Error(`Could not create the ${label} synthetic staging identity.`);
    createdUsers.push(created.data.user.id);
    actors.set(label, { id: created.data.user.id, email, password });
  }

  communityId = randomUUID();
  const publicChannelId = randomUUID();
  const privateChannelId = randomUUID();
  const roleIds = { owner: randomUUID(), admin: randomUUID(), moderator: randomUUID(), member: randomUUID() };
  const profileValues = actorLabels.map((label) => {
    const actor = actors.get(label);
    const username = `t661${runTag}${actorCodes[label]}`;
    if (username.length < 3 || username.length > 32) throw new Error(`Synthetic username length is invalid for ${label}.`);
    return `('${actor.id}','${username}', 'Task 661 ${label}', 'online', 'Hosted staging fixture')`;
  }).join(",\n");
  const membershipValues = [
    ["owner", roleIds.owner],
    ["admin", roleIds.admin],
    ["moderator", roleIds.moderator],
    ["member", roleIds.member],
    ["banned", roleIds.member],
    ["rate_limit", roleIds.member],
  ].map(([label, roleId]) => `('${communityId}','${actors.get(label).id}',${roleId ? `'${roleId}'` : "null"})`).join(",\n");
  await query(`
begin;
insert into public.profiles(id,username,display_name,status,status_text) values
${profileValues}
on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,status=excluded.status,status_text=excluded.status_text,deletion_requested_at=null,is_bot=false;
insert into public.communities(id,owner_id,name,description,kind,visibility,public_read_enabled,type_settings)
values('${communityId}','${actors.get("owner").id}','Task 661 Voice Fixture','Ephemeral protected staging fixture','text','private',false,'{"voiceRoomsEnabled":true}'::jsonb);
insert into public.roles(id,community_id,name,level,permissions,system_key,is_default) values
('${roleIds.owner}','${communityId}','Owner',100,'{}'::jsonb,'owner',false),
('${roleIds.admin}','${communityId}','Admin',80,'{}'::jsonb,'admin',false),
('${roleIds.moderator}','${communityId}','Moderator',60,'{}'::jsonb,'moderator',false),
('${roleIds.member}','${communityId}','Member',10,'{}'::jsonb,'member',true);
insert into public.community_members(community_id,user_id,role_id) values
${membershipValues};
alter table public.community_members disable trigger community_member_role_integrity;
insert into public.community_members(community_id,user_id,role_id) values
('${communityId}','${actors.get("roleless_member").id}',null);
alter table public.community_members enable trigger community_member_role_integrity;
insert into public.channels(id,community_id,name,type,is_private,public_read_enabled,position) values
('${publicChannelId}','${communityId}','task-661-voice','voice',false,true,0),
('${privateChannelId}','${communityId}','task-661-private-voice','voice',true,false,1);
insert into public.community_bans(community_id,user_id,banned_by,reason,revoked_at)
values('${communityId}','${actors.get("banned").id}','${actors.get("owner").id}','task-661 synthetic denial',null);
commit;`);

  const sessions = new Map();
  for (const label of actorLabels) {
    const actor = actors.get(label);
    const client = createClient(`https://${approvedProjectRef}.supabase.co`, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
    if (signedIn.error || !signedIn.data.session) throw new Error(`Could not authenticate the ${label} staging fixture.`);
    sessions.set(label, { client, token: signedIn.data.session.access_token, userId: actor.id });
  }

  const baseBody = { communityId, channelId: publicChannelId };
  const rateLimitSession = sessions.get("rate_limit");
  const rateLimitPreflight = await rateLimitSession.client.rpc("consume_current_user_action_rate_limit", { target_action: "livekit_token" });
  if (rateLimitPreflight.error) throw new Error(`Rate-limit RPC preflight failed ${safeDatabaseCode(rateLimitPreflight.error)}.`);
  await query("delete from public.user_action_rate_limits where user_id=$1::uuid and action_key='livekit_token'", [rateLimitSession.userId]);
  for (const label of activeLabels) {
    const session = sessions.get(label);
    const voice = await requestFunction({ publicKey, accessToken: session.token, body: { ...baseBody, intent: "voice" } });
    if (voice.response.status !== 200) throw new Error(`${label} Voice token expected 200, received ${voice.response.status} ${safeResponseCode(voice.payload)}.`);
    assertToken(voice.payload, session.userId, "voice");
    const screen = await requestFunction({ publicKey, accessToken: session.token, body: { ...baseBody, intent: "screen" } });
    if (screen.response.status !== 200) throw new Error(`${label} Screen token expected 200, received ${screen.response.status} ${safeResponseCode(screen.payload)}.`);
    assertToken(screen.payload, session.userId, "screen");
    const privateVoice = await requestFunction({ publicKey, accessToken: session.token, body: { ...baseBody, channelId: privateChannelId, intent: "voice" } });
    if (privateVoice.response.status !== 200) throw new Error(`${label} private Voice token expected 200, received ${privateVoice.response.status} ${safeResponseCode(privateVoice.payload)}.`);
    assertToken(privateVoice.payload, session.userId, "voice");
  }

  for (const label of deniedLabels) {
    const denied = await requestFunction({ publicKey, accessToken: sessions.get(label).token, body: { ...baseBody, intent: "voice" } });
    if (denied.response.status !== 403) throw new Error(`${label} expected 403, received ${denied.response.status}.`);
  }

  const wrongMethod = await requestFunction({ publicKey, method: "GET" });
  if (wrongMethod.response.status !== 405) throw new Error(`Wrong method expected 405, received ${wrongMethod.response.status}.`);
  const malformed = await requestFunction({ publicKey, rawBody: "{" });
  if (malformed.response.status !== 400) throw new Error(`Malformed body expected 400, received ${malformed.response.status}.`);
  const deniedOrigin = await requestFunction({ publicKey, origin: "https://not-allowed.invalid", body: baseBody });
  if (deniedOrigin.response.status !== 403) throw new Error(`Denied origin expected 403, received ${deniedOrigin.response.status}.`);
  const missingJwt = await requestFunction({ publicKey, body: baseBody });
  if (![401, 403].includes(missingJwt.response.status)) throw new Error(`Missing JWT was accepted with ${missingJwt.response.status}.`);

  const rateSession = sessions.get("rate_limit");
  for (let attempt = 1; attempt <= 11; attempt += 1) {
    const result = await requestFunction({ publicKey, accessToken: rateSession.token, body: { ...baseBody, intent: "voice" } });
    if (attempt <= 10 && result.response.status !== 200) throw new Error(`Rate-limit request ${attempt} expected 200, received ${result.response.status}.`);
    if (attempt === 11 && (result.response.status !== 429 || result.payload?.code !== "RATE_LIMITED")) throw new Error(`Rate-limit request 11 expected 429 RATE_LIMITED, received ${result.response.status}.`);
  }

  for (const session of sessions.values()) await session.client.auth.signOut({ scope: "local" });
  writeEvidence({
    status: "passed",
    hostedFixture: "ephemeral-cleanup",
    activeMemberCasesPassed: activeLabels,
    deniedCasesPassed: deniedLabels,
    privateVoiceMemberAccessPassed: true,
    microphoneGrantPassed: true,
    screenShareGrantPassed: true,
    screenShareAudioGrantPassed: true,
    cameraAndDataDenied: true,
    corsMethodBodyJwtPassed: true,
    rateLimitPassed: "10_per_60s_then_429",
    providerCredentialsAbsentFromResponses: true,
    syntheticUserCount: actorLabels.length,
    containsSecrets: false,
    finishedAt: new Date().toISOString(),
  });
  console.log("Hosted active-member LiveKit token matrix passed for owner/admin/moderator/member/roleless member plus visitor/non-member/banned and rate-limit denials; no token, credential, fixture email, or raw identifier was printed.");
} catch (error) {
  const safeMessage = redact(error instanceof Error ? error.message : error);
  writeEvidence({ status: "failed", hostedFailure: safeMessage, finishedAt: new Date().toISOString(), containsSecrets: false });
  throw new Error(safeMessage);
} finally {
  if (communityId) {
    try { await query("delete from public.communities where id=$1::uuid", [communityId]); } catch {}
  }
  for (const userId of createdUsers.reverse()) {
    try { await admin.auth.admin.deleteUser(userId); } catch {}
  }
}
