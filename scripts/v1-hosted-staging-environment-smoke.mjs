import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const staging = read(".env.staging.example");
const production = read(".env.production.example");
const workflow = read(".github/workflows/hosted-validation.yml");
const requiredStagingLines = [
  "VITE_DATA_SOURCE=supabase",
  "VITE_RELEASE_CHANNEL=beta",
  "VITE_SUPABASE_URL=https://ufmtvqtsklqsmqxefbbs.supabase.co",
  "VITE_SUPABASE_ANON_KEY=",
  "VITE_LIVEKIT_ENABLED=true",
  "VITE_LIVEKIT_URL=wss://picom-blmsm07k.livekit.cloud",
];
const forbiddenRendererAssignments = [
  /^VITE_.*LIVEKIT_API_KEY=.+$/m,
  /^VITE_.*LIVEKIT_API_SECRET=.+$/m,
  /^VITE_.*SERVICE_ROLE=.+$/m,
  /^VITE_.*ACCESS_TOKEN=.+$/m,
];
const productionForbidden = [
  "ufmtvqtsklqsmqxefbbs",
  "picom-blmsm07k.livekit.cloud",
  "hosted-staging",
];
const failures = [];
for (const line of requiredStagingLines) if (!staging.includes(line)) failures.push(`missing staging contract: ${line}`);
for (const pattern of forbiddenRendererAssignments) if (pattern.test(staging)) failures.push(`server secret assigned to renderer: ${pattern}`);
for (const marker of productionForbidden) if (production.includes(marker)) failures.push(`staging marker leaked into production example: ${marker}`);
if (!workflow.includes("environment: hosted-staging")) failures.push("hosted workflow does not use hosted-staging environment");
if (!workflow.includes("staging_confirmation == 'STAGING_ONLY'")) failures.push("hosted workflow lacks STAGING_ONLY guard");
if (/LIVEKIT_API_SECRET\s*:\s*\$\{\{\s*(vars|secrets)\./.test(workflow)) failures.push("ordinary hosted validation receives provider API secret");
if (failures.length) {
  console.error("V1 hosted staging environment contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("V1 hosted staging environment contract: PASS");
console.log("- renderer config contains public values/placeholders only");
console.log("- production env example contains no staging endpoint/ref");
console.log("- hosted workflow remains manual, protected, and staging-confirmed");