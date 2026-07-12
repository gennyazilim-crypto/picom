import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const required = ["PICOM_EDGE_STAGING_URL", "PICOM_EDGE_STAGING_ANON_KEY", "PICOM_EDGE_STAGING_CONFIRM", "PICOM_EDGE_TEST_EMAIL", "PICOM_EDGE_TEST_PASSWORD", "PICOM_EDGE_ALLOWED_ORIGIN"];
const fail = (message) => { throw new Error(message); };
const pass = (message) => console.log(`PASS ${message}`);
if (!shouldRun) {
  console.log(`Hosted V1 Edge validation requires --run and configuration names: ${required.join(", ")}`);
  console.log("No network request was made and no configuration value was printed.");
  process.exit(0);
}
for (const name of required) if (!process.env[name]?.trim()) fail(`Missing required hosted configuration: ${name}`);
if (process.env.PICOM_EDGE_STAGING_CONFIRM !== "STAGING_ONLY") fail("Hosted Edge validation requires PICOM_EDGE_STAGING_CONFIRM=STAGING_ONLY.");
const baseUrl = process.env.PICOM_EDGE_STAGING_URL.replace(/\/$/, "");
const anonKey = process.env.PICOM_EDGE_STAGING_ANON_KEY;
const origin = process.env.PICOM_EDGE_ALLOWED_ORIGIN;
const client = createClient(baseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { data: authData, error: authError } = await client.auth.signInWithPassword({ email: process.env.PICOM_EDGE_TEST_EMAIL, password: process.env.PICOM_EDGE_TEST_PASSWORD });
if (authError || !authData.session?.access_token) fail("Synthetic Edge test account could not authenticate.");
const token = authData.session.access_token;
async function invoke(name, { method = "POST", authorization = token, requestOrigin = origin, body } = {}) {
  const headers = { apikey: anonKey, Origin: requestOrigin };
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}/functions/v1/${name}`, { method, headers, body });
}
try {
  const configResponse = await invoke("client-config", { method: "GET", authorization: null });
  if (configResponse.status !== 200) fail("client-config did not return 200.");
  const config = await configResponse.json();
  if (config?.featureFlags?.enableDirectMessages !== true || config?.featureFlags?.enableVoiceRooms !== false) fail("Deployed client-config does not match V1 scope.");
  pass("public client-config and V1 flags");
  const noJwt = await invoke("validate-file", { authorization: null, body: JSON.stringify({}) });
  if (noJwt.status !== 401) fail("validate-file did not reject a missing JWT.");
  pass("authenticated JWT boundary");
  const wrongMethod = await invoke("validate-file", { method: "GET" });
  if (wrongMethod.status !== 405) fail("validate-file did not reject an unsupported method.");
  pass("method boundary");
  const malformedBody = await invoke("validate-file", { body: "{" });
  if (malformedBody.status !== 400) fail("validate-file did not reject malformed JSON.");
  pass("JSON body boundary");
  const oversizedBody = await invoke("validate-file", { body: JSON.stringify({ fileName: "x", padding: "x".repeat(70 * 1024) }) });
  if (![400, 413].includes(oversizedBody.status)) fail("validate-file did not reject an oversized/invalid body.");
  pass("bounded body handling");
  const deniedOrigin = await invoke("validate-file", { requestOrigin: "https://invalid.picom.test", body: JSON.stringify({}) });
  if (deniedOrigin.status !== 403) fail("validate-file did not reject an unapproved Origin.");
  pass("CORS origin allowlist");
  const exportOne = await invoke("user-data-export", { body: JSON.stringify({ format: "json" }) });
  if (![200, 202].includes(exportOne.status)) fail("user-data-export staging fixture could not create its first bounded export request.");
  const exportTwo = await invoke("user-data-export", { body: JSON.stringify({ format: "json" }) });
  if (exportTwo.status !== 429) fail("user-data-export rate limit did not reject the immediate duplicate request.");
  pass("per-user export rate limit");
} finally {
  await client.auth.signOut({ scope: "local" });
}
console.log("Hosted V1 Edge Function boundaries passed. No credentials, tokens, URLs, IDs, or response payloads were printed.");
