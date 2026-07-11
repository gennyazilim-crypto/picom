import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const manifest = JSON.parse(read("supabase/functions/release-manifest.json"));
const config = read("supabase/config.toml");
const cors = read("supabase/functions/_shared/cors.ts");
const bounded = read("supabase/functions/_shared/request.ts");
const runner = read("scripts/hosted-staging-edge-functions-validation.mjs");
const failed = [];
const deployed = [...manifest.releasePublic,...manifest.releaseAuthenticated,...manifest.releaseInternal];
const excluded = new Set(manifest.excluded.map((item) => item.name));

for(const item of deployed){
  const source=read(`supabase/functions/${item.name}/index.ts`);
  const expected=`[functions.${item.name}]`;
  if(!config.includes(expected))failed.push(`${item.name} explicit config`);
  const section=config.slice(config.indexOf(expected),config.indexOf(expected)+100);
  if(!section.includes(`verify_jwt = ${item.verifyJwt}`))failed.push(`${item.name} verify_jwt`);
  if(/sb_secret_[A-Za-z0-9_-]+/.test(source)||/console\.(log|warn|error|info)/.test(source))failed.push(`${item.name} secret/log boundary`);
}
for(const item of manifest.releaseAuthenticated){
  const source=read(`supabase/functions/${item.name}/index.ts`);
  if(!source.includes("requireSupabaseUser"))failed.push(`${item.name} user JWT verification`);
}
for(const name of ["livekit-moderation","validate-file","account-deletion"]){if(!read(`supabase/functions/${name}/index.ts`).includes("readBoundedJsonObject"))failed.push(`${name} bounded body`);}
if(!cors.includes("PICOM_ALLOWED_ORIGINS")||!cors.includes("Origin is not allowed")||cors.includes("Access-Control-Allow-Credentials"))failed.push("strict non-cookie CORS boundary");
if(!bounded.includes("Content-Type must be application/json")||!bounded.includes("PAYLOAD_TOO_LARGE"))failed.push("bounded JSON helper");
for(const item of manifest.excluded){const source=read(`supabase/functions/${item.name}/index.ts`);if(item.classification==="placeholder"&&!source.includes("NOT_IMPLEMENTED"))failed.push(`${item.name} truthful placeholder`);}
if(!runner.includes("release-manifest.json")||runner.includes("INVITE_ACCEPTANCE_NOT_IMPLEMENTED")||runner.includes("MODERATION_HELPER_NOT_IMPLEMENTED"))failed.push("hosted release-only matrix");
const sourceNames=readdirSync("supabase/functions",{withFileTypes:true}).filter((entry)=>entry.isDirectory()&&entry.name!=="_shared").map((entry)=>entry.name).sort();
const inventoried=[...deployed.map((item)=>item.name),...excluded].sort();
if(JSON.stringify(sourceNames)!==JSON.stringify(inventoried))failed.push("complete function inventory");
if(failed.length)throw new Error(`Edge release contract failed: ${failed.join(", ")}`);
console.log("Release Edge Function inventory, JWT, CORS, body, secret, and exclusion contract passed.");
