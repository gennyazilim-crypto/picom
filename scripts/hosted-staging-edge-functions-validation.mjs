import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const requiredNames = [
  "PICOM_EDGE_STAGING_URL",
  "PICOM_EDGE_STAGING_ANON_KEY",
  "PICOM_EDGE_STAGING_CONFIRM",
  "PICOM_EDGE_STAGING_USER_EMAIL",
  "PICOM_EDGE_STAGING_USER_PASSWORD",
  "PICOM_EDGE_STAGING_ORIGIN",
  "PICOM_EDGE_COMMUNITY_ID",
  "PICOM_EDGE_VOICE_CHANNEL_ID",
  "PICOM_EDGE_INVITE_CODE",
];
const missing = requiredNames.filter((name) => !process.env[name]?.trim());
const functionNames = ["livekit-token", "accept-invite", "moderation-helper"];

function fail(message) { throw new Error(`Hosted staging Edge Function validation failed: ${message}`); }
function pass(message) { console.log(`OK ${message}`); }

function validateConfiguration() {
  if (missing.length) fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if (process.env.PICOM_EDGE_STAGING_CONFIRM !== "STAGING_ONLY") fail("PICOM_EDGE_STAGING_CONFIRM must equal STAGING_ONLY.");
  if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_EDGE_STAGING_ANON_KEY)) fail("key must be anon/publishable, not service-role.");
  let url;
  let origin;
  try { url = new URL(process.env.PICOM_EDGE_STAGING_URL); } catch { fail("staging URL is invalid."); }
  try { origin = new URL(process.env.PICOM_EDGE_STAGING_ORIGIN); } catch { fail("test Origin is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) fail("staging URL must be credential-free HTTPS.");
  if (!/^https?:$/.test(origin.protocol)) fail("test Origin must use HTTP(S).");
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(process.env.PICOM_EDGE_INVITE_CODE)) fail("synthetic invite code format is invalid.");
}

async function callFunction(name, { method = "POST", accessToken, body } = {}) {
  const headers = {
    apikey: process.env.PICOM_EDGE_STAGING_ANON_KEY,
    Origin: process.env.PICOM_EDGE_STAGING_ORIGIN,
    "x-picom-api-version": "1",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${process.env.PICOM_EDGE_STAGING_URL.replace(/\/+$/, "")}/functions/v1/${name}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }
  return { response, payload };
}

function assertCors(response, label) {
  const allowOrigin = response.headers.get("access-control-allow-origin");
  if (allowOrigin !== "*" && allowOrigin !== process.env.PICOM_EDGE_STAGING_ORIGIN) fail(`${label} has an unexpected CORS origin policy.`);
  if (response.headers.get("access-control-allow-credentials")) fail(`${label} must not enable credentialed wildcard CORS.`);
}

async function validateProtection(name) {
  const options = await callFunction(name, { method: "OPTIONS" });
  if (!options.response.ok) fail(`${name} preflight returned ${options.response.status}.`);
  assertCors(options.response, `${name} preflight`);
  const methods = options.response.headers.get("access-control-allow-methods") ?? "";
  if (!methods.includes("POST") || !methods.includes("OPTIONS")) fail(`${name} preflight omits required methods.`);

  const missingJwt = await callFunction(name, { body: {} });
  if (![401, 403].includes(missingJwt.response.status)) fail(`${name} accepted a missing JWT.`);
  assertCors(missingJwt.response, `${name} missing JWT response`);

  const invalidJwt = await callFunction(name, { accessToken: "invalid.synthetic.jwt", body: {} });
  if (![401, 403].includes(invalidJwt.response.status)) fail(`${name} accepted an invalid JWT.`);
  assertCors(invalidJwt.response, `${name} invalid JWT response`);
  pass(`${name}: CORS and JWT rejection`);
}

if (!shouldRun) {
  console.log("Hosted staging Edge Function runner requires --run plus explicit STAGING_ONLY confirmation.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log(`Protected functions: ${functionNames.join(", ")}`);
  console.log("No network connection was made and no credential values were printed.");
  process.exit(0);
}

validateConfiguration();
for (const name of functionNames) await validateProtection(name);

const authClient = createClient(process.env.PICOM_EDGE_STAGING_URL, process.env.PICOM_EDGE_STAGING_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
  email: process.env.PICOM_EDGE_STAGING_USER_EMAIL,
  password: process.env.PICOM_EDGE_STAGING_USER_PASSWORD,
});
const accessToken = authData.session?.access_token;
if (authError || !accessToken || !authData.user) fail("synthetic staging user authentication failed.");

try {
  for (const name of functionNames) {
    const wrongMethod = await callFunction(name, { method: "GET", accessToken });
    if (wrongMethod.response.status !== 405) fail(`${name} authenticated GET expected 405, received ${wrongMethod.response.status}.`);
    assertCors(wrongMethod.response, `${name} method response`);
  }

  const invite = await callFunction("accept-invite", { accessToken, body: { code: process.env.PICOM_EDGE_INVITE_CODE } });
  if (invite.response.status !== 501 || invite.payload?.code !== "INVITE_ACCEPTANCE_NOT_IMPLEMENTED" || invite.payload?.accepted !== false) {
    fail("accept-invite placeholder contract changed or executed an action.");
  }
  pass("accept-invite authenticated safe placeholder");

  const moderation = await callFunction("moderation-helper", {
    accessToken,
    body: { communityId: process.env.PICOM_EDGE_COMMUNITY_ID, targetId: "staging-validation-target", action: "delete_message", reason: "staging validation" },
  });
  if (moderation.response.status !== 501 || moderation.payload?.code !== "MODERATION_HELPER_NOT_IMPLEMENTED" || moderation.payload?.details?.applied !== false) {
    fail("moderation-helper placeholder contract changed or applied an action.");
  }
  pass("moderation-helper authenticated safe placeholder");

  const livekit = await callFunction("livekit-token", {
    accessToken,
    body: { communityId: process.env.PICOM_EDGE_COMMUNITY_ID, channelId: process.env.PICOM_EDGE_VOICE_CHANNEL_ID, intent: "voice", participantName: "Staging validation" },
  });
  if (livekit.response.status !== 200 || typeof livekit.payload?.token !== "string" || livekit.payload.token.length < 20) {
    fail(`livekit-token did not issue a token; status ${livekit.response.status}.`);
  }
  if (livekit.payload.identity !== authData.user.id || !String(livekit.payload.roomName ?? "").includes(process.env.PICOM_EDGE_VOICE_CHANNEL_ID)) {
    fail("livekit-token identity or deterministic room binding is invalid.");
  }
  const expiresAt = Date.parse(livekit.payload.expiresAt ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 65 * 60 * 1000) fail("livekit-token expiry is outside the expected short-lived window.");
  pass("livekit-token authenticated channel-bound short-lived response (token not printed)");
} finally {
  await authClient.auth.signOut({ scope: "local" });
}

console.log("Hosted staging Edge Function validation passed without logging response tokens, URLs, credentials, or private data.");
