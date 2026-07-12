import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const evidencePath = resolve("artifacts/evidence/v1-core-hosted-e2e.json");
const confirmation = process.env.PICOM_V1_CORE_CONFIRM;
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (confirmation !== "STAGING_ONLY") throw new Error("Hosted V1 core validation requires PICOM_V1_CORE_CONFIRM=STAGING_ONLY.");
if (!accessToken) throw new Error("Protected Supabase management access is unavailable.");
if (projectRef !== approvedProjectRef) throw new Error("Hosted V1 core validation is restricted to the approved Picom project.");

const runTag = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
const projectUrl = `https://${approvedProjectRef}.supabase.co`;
const createdUserIds = [];
const channels = [];
let admin;
let communityId = "";
let directConversationId = "";
let primaryError = null;

const evidence = {
  schemaVersion: 1,
  task: "v1-core-hosted-e2e",
  status: "failed",
  environment: "hosted-staging",
  checks: {
    publicRegistration: false,
    loginSession: false,
    profileProvisioning: false,
    communityCreation: false,
    communityJoin: false,
    communityMessage: false,
    communityRealtime: false,
    mentionFeed: false,
    profileDomain: false,
    directConversation: false,
    directMessage: false,
    directRealtime: false,
    directReadState: false,
    cleanup: false,
  },
  containsSecrets: false,
};

function safeMessage(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/sbp_[A-Za-z0-9_-]+/g, "[redacted-supabase-token]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-supabase-key]")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-jwt]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[redacted-id]")
    .slice(0, 500);
}

function writeEvidence() {
  mkdirSync(resolve("artifacts/evidence"), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function pass(label, key) {
  evidence.checks[key] = true;
  console.log(`OK ${label}`);
}

function fail(label, error) {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  throw new Error(`${label} failed (${code}).`);
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function keyName(record) {
  return String(record?.name ?? record?.type ?? record?.key_name ?? "").toLowerCase();
}

function keyValue(record) {
  for (const candidate of [record?.api_key, record?.value, record?.key]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Supabase Management API request failed (${response.status}).`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createPublicClient(publicKey) {
  return createClient(projectUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

async function subscribe(channel, label) {
  await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error(`${label} subscription timed out.`)), 20_000);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolvePromise();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        rejectPromise(new Error(`${label} subscription failed with ${status}${error?.message ? ` (${safeMessage(error.message)})` : ""}.`));
      }
    });
  });
  channels.push(channel);
}

async function waitFor(check, label, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  throw new Error(`${label} timed out.`);
}

async function registerAndLogin(publicKey, label) {
  const email = `picom-v1-core-${runTag}-${label}@example.com`;
  const password = `P!c0m-${randomBytes(20).toString("base64url")}`;
  const registrationClient = createPublicClient(publicKey);
  const registration = await registrationClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: `Picom V1 ${label.toUpperCase()}`,
        accepted_terms_version: "beta-2026-07-10.1",
        accepted_privacy_version: "beta-2026-07-10.1",
      },
    },
  });
  if (registration.error || !registration.data.user) fail(`${label} public registration`, registration.error);
  createdUserIds.push(registration.data.user.id);

  const confirmed = await admin.auth.admin.updateUserById(registration.data.user.id, { email_confirm: true });
  if (confirmed.error) fail(`${label} email confirmation`, confirmed.error);

  const client = createPublicClient(publicKey);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.user || !login.data.session?.access_token) fail(`${label} login`, login.error);
  await client.realtime.setAuth(login.data.session.access_token);

  let profile = null;
  await waitFor(async () => {
    const result = await admin.from("profiles").select("id,username,display_name").eq("id", login.data.user.id).maybeSingle();
    if (result.error) fail(`${label} profile lookup`, result.error);
    profile = result.data;
    return Boolean(profile?.id && profile?.username);
  }, `${label} profile provisioning`);

  return { id: login.data.user.id, client, profile };
}

try {
  const keys = await management(`/projects/${approvedProjectRef}/api-keys?reveal=true`);
  const keyRows = Array.isArray(keys) ? keys : [];
  const publicRecord = keyRows.find((item) => /(^|[^a-z])(anon|publishable)([^a-z]|$)/.test(keyName(item))) ?? keyRows.find((item) => keyName(item).includes("publishable"));
  const secretRecord = keyRows.find((item) => /service.?role/.test(keyName(item))) ?? keyRows.find((item) => keyName(item).includes("secret"));
  const publicKey = keyValue(publicRecord);
  const serviceKey = keyValue(secretRecord);
  if (!publicKey || !serviceKey) throw new Error("Protected publishable and service keys could not be resolved.");

  admin = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const actorA = await registerAndLogin(publicKey, "alpha");
  const actorB = await registerAndLogin(publicKey, "beta");
  pass("public registration for two disposable users", "publicRegistration");
  pass("password login and authenticated sessions", "loginSession");
  pass("Auth profile trigger provisioning", "profileProvisioning");

  const created = await actorA.client.rpc("create_text_community_with_defaults", {
    target_creation_request_id: randomUUID(),
    community_name: `Picom V1 Core ${runTag}`,
    community_description: "Ephemeral hosted V1 core validation fixture",
    community_icon_url: null,
    community_accent_color: "#007571",
    community_visibility: "public",
    community_public_read_enabled: true,
    community_template_id: "custom",
  });
  const community = firstRow(created.data);
  if (created.error || !community?.id) fail("community creation", created.error);
  communityId = community.id;
  pass("atomic Text community creation", "communityCreation");

  const communityState = await actorA.client.from("communities").select("id,rules_version").eq("id", communityId).single();
  if (communityState.error) fail("community state", communityState.error);
  const textChannel = await actorA.client.from("channels").select("id,name,type").eq("community_id", communityId).eq("type", "text").order("position", { ascending: true }).limit(1).single();
  if (textChannel.error || !textChannel.data?.id) fail("starter channel lookup", textChannel.error);

  const joined = await actorB.client.rpc("join_public_community", {
    target_community_id: communityId,
    accepted_rules_version: communityState.data.rules_version ?? null,
  });
  if (joined.error || !firstRow(joined.data)?.member_id) fail("public community join", joined.error);
  pass("second user public community join", "communityJoin");

  const followed = await actorB.client.rpc("follow_user", { target_user_id: actorA.id });
  if (followed.error) fail("follow mutation", followed.error);

  let communityRealtimeMessageId = "";
  const communityRealtime = actorB.client
    .channel(`v1-core-community:${runTag}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${textChannel.data.id}` }, (payload) => {
      if (payload.new?.client_message_id === `v1-core-${runTag}`) communityRealtimeMessageId = payload.new.id;
    });
  await subscribe(communityRealtime, "community message");

  const sent = await actorA.client.rpc("send_text_message_idempotent", {
    target_community_id: communityId,
    target_channel_id: textChannel.data.id,
    message_body: `@${actorB.profile.username} Picom V1 hosted Feed and realtime validation`,
    target_client_message_id: `v1-core-${runTag}`,
    target_reply_to_message_id: null,
    target_attachment_ids: [],
  });
  const sentMessage = firstRow(sent.data);
  if (sent.error || !sentMessage?.id) fail("community message send", sent.error);
  pass("real community message send", "communityMessage");
  await waitFor(() => communityRealtimeMessageId === sentMessage.id, "community realtime delivery");
  pass("two-user community realtime delivery", "communityRealtime");

  await waitFor(async () => {
    const feed = await actorB.client.rpc("list_mention_feed", { cursor_created_at: null, cursor_message_id: null, result_limit: 20 });
    if (feed.error) fail("Mention Feed query", feed.error);
    return (feed.data ?? []).some((item) => item.message_id === sentMessage.id);
  }, "Mention Feed projection");
  pass("real Mention Feed projection", "mentionFeed");

  const profileDomain = await actorB.client.rpc("get_profile_domain_v1", { target_user_id: actorA.id, result_limit: 10 });
  if (profileDomain.error || !profileDomain.data || profileDomain.data.privacy?.can_view_profile !== true) fail("profile domain", profileDomain.error);
  pass("privacy-projected profile domain", "profileDomain");

  const directCreated = await actorA.client.rpc("create_direct_conversation", { other_user_id: actorB.id });
  if (directCreated.error || !directCreated.data) fail("direct conversation creation", directCreated.error);
  directConversationId = directCreated.data;
  pass("real Direct Message conversation creation", "directConversation");

  let directRealtimeMessageId = "";
  const directRealtime = actorB.client
    .channel(`v1-core-dm:${runTag}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${directConversationId}` }, (payload) => {
      if (payload.new?.client_message_id === `v1-core-dm-${runTag}`) directRealtimeMessageId = payload.new.id;
    });
  await subscribe(directRealtime, "direct message");

  const directSent = await actorA.client.rpc("send_direct_message_v3", {
    target_conversation_id: directConversationId,
    message_body: "Picom V1 hosted Direct Message validation",
    target_client_message_id: `v1-core-dm-${runTag}`,
    target_reply_to_message_id: null,
    target_attachments: [],
  });
  const directMessage = firstRow(directSent.data);
  if (directSent.error || !directMessage?.id) fail("direct message send", directSent.error);
  pass("real Direct Message send", "directMessage");
  await waitFor(() => directRealtimeMessageId === directMessage.id, "direct message realtime delivery");
  pass("two-user Direct Message realtime delivery", "directRealtime");

  const directList = await actorB.client.rpc("list_direct_conversations", { result_limit: 20 });
  if (directList.error || !(directList.data ?? []).some((item) => item.id === directConversationId)) fail("direct conversation list", directList.error);
  const visibleDirectMessage = await actorB.client.from("direct_messages").select("id").eq("id", directMessage.id).maybeSingle();
  if (visibleDirectMessage.error || visibleDirectMessage.data?.id !== directMessage.id) fail("direct message participant read", visibleDirectMessage.error);
  const markedRead = await actorB.client.rpc("mark_direct_conversation_read_to", { target_conversation_id: directConversationId, target_message_id: directMessage.id });
  if (markedRead.error || markedRead.data !== true) fail("direct read state", markedRead.error);
  pass("Direct Message participant read and read marker", "directReadState");

  evidence.status = "passed";
  console.log("HOSTED PASS Picom V1 Auth, Profile, Community, Message, Feed, DM, and Realtime core flows are operational.");
} catch (error) {
  primaryError = error;
  evidence.failure = safeMessage(error);
  console.error(`HOSTED FAIL ${evidence.failure}`);
} finally {
  try {
    if (admin) {
      if (directConversationId) await admin.from("direct_conversations").delete().eq("id", directConversationId);
      if (communityId) await admin.from("communities").delete().eq("id", communityId);
      for (const userId of [...createdUserIds].reverse()) await admin.auth.admin.deleteUser(userId);
    }
    evidence.checks.cleanup = true;
  } catch (cleanupError) {
    evidence.cleanupFailure = safeMessage(cleanupError);
    if (!primaryError) primaryError = cleanupError;
  }
  writeEvidence();
}

if (primaryError) process.exitCode = 1;
