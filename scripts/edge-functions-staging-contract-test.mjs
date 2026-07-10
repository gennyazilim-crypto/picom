import { readFileSync, readdirSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const cors = readFileSync("supabase/functions/_shared/cors.ts", "utf8");
const runner = readFileSync("scripts/hosted-staging-edge-functions-validation.mjs", "utf8");
const functions = ["livekit-token", "accept-invite", "moderation-helper"];
const failed = [];

for (const name of functions) {
  const source = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
  if (!config.includes(`[functions.${name}]\nverify_jwt = true`) && !config.includes(`[functions.${name}]\r\nverify_jwt = true`)) failed.push(`${name} verify_jwt`);
  if (!source.includes("handleCorsPreflight") || !source.includes("requireSupabaseUser")) failed.push(`${name} auth/CORS helpers`);
  if (/SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]+/.test(source)) failed.push(`${name} service-role reference/value`);
}

if (!cors.includes('"Access-Control-Allow-Origin": "*"') || cors.includes("Access-Control-Allow-Credentials")) failed.push("reviewed non-cookie CORS contract");
for (const marker of ["STAGING_ONLY", "invalid.synthetic.jwt", "INVITE_ACCEPTANCE_NOT_IMPLEMENTED", "MODERATION_HELPER_NOT_IMPLEMENTED", "token not printed"]) {
  if (!runner.includes(marker)) failed.push(`runner marker ${marker}`);
}
if (!runner.includes("response.headers.get(\"access-control-allow-origin\")")) failed.push("actual response CORS assertion");

const sourceNames = readdirSync("supabase/functions").filter((name) => functions.includes(name));
if (sourceNames.length !== functions.length) failed.push("required deployed function source inventory");
if (failed.length) throw new Error(`Edge staging contract failed: ${failed.join(", ")}`);
console.log("Edge Function JWT, CORS, placeholder, LiveKit, and secret-boundary contract passed.");
