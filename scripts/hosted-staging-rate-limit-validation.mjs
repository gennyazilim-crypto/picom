import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const requiredNames = [
  "PICOM_RATE_STAGING_URL",
  "PICOM_RATE_STAGING_ANON_KEY",
  "PICOM_RATE_STAGING_CONFIRM",
  "PICOM_RATE_STAGING_USER_A_EMAIL",
  "PICOM_RATE_STAGING_USER_A_PASSWORD",
  "PICOM_RATE_STAGING_USER_B_EMAIL",
  "PICOM_RATE_STAGING_USER_B_PASSWORD",
  "PICOM_RATE_COMMUNITY_ID",
  "PICOM_RATE_CHANNEL_ID",
  "PICOM_RATE_VOICE_CHANNEL_ID",
];
const missing = requiredNames.filter((name) => !process.env[name]?.trim());
function fail(message) { throw new Error(`Hosted staging rate-limit validation failed: ${message}`); }
function pass(message) { console.log(`OK ${message}`); }

function validateConfiguration() {
  if (missing.length) fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if (process.env.PICOM_RATE_STAGING_CONFIRM !== "STAGING_ONLY_FRESH_SYNTHETIC_USERS") fail("explicit fresh-user staging confirmation is required.");
  if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_RATE_STAGING_ANON_KEY)) fail("key must be anon/publishable, not service-role.");
  let url;
  try { url = new URL(process.env.PICOM_RATE_STAGING_URL); } catch { fail("staging URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) fail("staging URL must be credential-free HTTPS.");
}

function createStagingClient() {
  return createClient(process.env.PICOM_RATE_STAGING_URL, process.env.PICOM_RATE_STAGING_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticate(client, label, emailName, passwordName) {
  const { data, error } = await client.auth.signInWithPassword({ email: process.env[emailName], password: process.env[passwordName] });
  if (error || !data.user || !data.session?.access_token) fail(`${label} authentication failed.`);
  return { userId: data.user.id, accessToken: data.session.access_token };
}

async function consume(client, action, allowedCount, windowSeconds) {
  for (let index = 0; index < allowedCount; index += 1) {
    const { data, error } = await client.rpc("consume_current_user_action_rate_limit", { target_action: action });
    const row = data?.[0];
    if (error || !row?.is_allowed || row.retry_after_seconds !== 0) fail(`${action} denied before configured threshold.`);
  }
  const { data, error } = await client.rpc("consume_current_user_action_rate_limit", { target_action: action });
  const row = data?.[0];
  if (error || row?.is_allowed !== false) fail(`${action} threshold+1 was not denied.`);
  const retryAfter = Number(row.retry_after_seconds);
  if (!Number.isInteger(retryAfter) || retryAfter < 1 || retryAfter > windowSeconds) fail(`${action} returned invalid retry-after.`);
  pass(`${action}: ${allowedCount}/${windowSeconds}s then bounded denial`);
}

if (!shouldRun) {
  console.log("Hosted staging rate-limit runner requires --run and fresh dedicated synthetic users.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log("No network connection was made and no credential values were printed.");
  process.exit(0);
}

validateConfiguration();
const clientA = createStagingClient();
const clientB = createStagingClient();
const a = await authenticate(clientA, "user A", "PICOM_RATE_STAGING_USER_A_EMAIL", "PICOM_RATE_STAGING_USER_A_PASSWORD");
const b = await authenticate(clientB, "user B", "PICOM_RATE_STAGING_USER_B_EMAIL", "PICOM_RATE_STAGING_USER_B_PASSWORD");
if (a.userId === b.userId) fail("two distinct synthetic users are required.");

try {
  await consume(clientA, "message_send", 30, 60);
  const secondUser = await clientB.rpc("consume_current_user_action_rate_limit", { target_action: "message_send" });
  if (secondUser.error || secondUser.data?.[0]?.is_allowed !== true) fail("second-user message bucket is not isolated.");
  pass("message limiter is user-isolated");

  const clientMessageId = `rate-test-${crypto.randomUUID()}`;
  const blockedMessage = await clientA.from("messages").insert({
    community_id: process.env.PICOM_RATE_COMMUNITY_ID,
    channel_id: process.env.PICOM_RATE_CHANNEL_ID,
    author_id: a.userId,
    body: "Picom staging rate-limit validation.",
    client_message_id: clientMessageId,
  });
  if (!blockedMessage.error || !/RATE_LIMIT/i.test(`${blockedMessage.error.code ?? ""} ${blockedMessage.error.message ?? ""}`)) fail("message trigger did not reject UI bypass after threshold.");
  const messageRows = await clientA.from("messages").select("id").eq("client_message_id", clientMessageId);
  if (messageRows.error || messageRows.data?.length) fail("rate-limited message created a row.");
  pass("message trigger bypass attempt denied without row");

  await consume(clientA, "attachment_metadata", 20, 300);
  const storagePath = `communities/${process.env.PICOM_RATE_COMMUNITY_ID}/channels/${process.env.PICOM_RATE_CHANNEL_ID}/pending/${a.userId}/rate-test-${crypto.randomUUID()}.png`;
  const blockedAttachment = await clientA.from("attachments").insert({
    uploader_id: a.userId,
    storage_path: storagePath,
    file_name: "rate-test.png",
    mime_type: "image/png",
    size_bytes: 12,
    attachment_type: "image",
    status: "pending",
  });
  if (!blockedAttachment.error || !/RATE_LIMIT/i.test(`${blockedAttachment.error.code ?? ""} ${blockedAttachment.error.message ?? ""}`)) fail("attachment metadata trigger did not deny threshold+1.");
  const attachmentRows = await clientA.from("attachments").select("id").eq("storage_path", storagePath);
  if (attachmentRows.error || attachmentRows.data?.length) fail("rate-limited attachment metadata created a row.");
  pass("attachment metadata trigger denied without row");

  await consume(clientA, "livekit_token", 10, 60);
  const response = await fetch(`${process.env.PICOM_RATE_STAGING_URL.replace(/\/+$/, "")}/functions/v1/livekit-token`, {
    method: "POST",
    headers: { apikey: process.env.PICOM_RATE_STAGING_ANON_KEY, Authorization: `Bearer ${a.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ communityId: process.env.PICOM_RATE_COMMUNITY_ID, channelId: process.env.PICOM_RATE_VOICE_CHANNEL_ID, intent: "voice" }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  const retryAfter = Number(response.headers.get("retry-after"));
  if (response.status !== 429 || payload?.code !== "RATE_LIMITED" || typeof payload?.token === "string") fail("LiveKit threshold denial returned the wrong status/body or issued a token.");
  if (!Number.isInteger(retryAfter) || retryAfter < 1 || retryAfter > 3600) fail("LiveKit denial returned invalid Retry-After.");
  pass("LiveKit Edge Function 429/Retry-After without token");
} finally {
  await Promise.all([clientA.auth.signOut({ scope: "local" }), clientB.auth.signOut({ scope: "local" })]);
}

console.log("Hosted staging enforced-rate-limit validation passed. Auth/invite/search/Storage-byte/other Edge gaps remain separate blockers.");
