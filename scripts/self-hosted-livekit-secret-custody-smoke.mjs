import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const inventory = JSON.parse(read("infra/livekit/secrets/secret-inventory.json"));
const owners = JSON.parse(read("infra/livekit/secrets/owner-roles.json"));
const rotate = read("infra/livekit/secrets/rotate-livekit-api-key.sh");
const emergency = read("infra/livekit/secrets/emergency-disable-media.sh");
const mix = read("scripts/self-hosted-livekit-environment-mix-check.mjs");
const docs = read("docs/self-hosted-livekit-secret-custody.md");

const checks = [
  ["value-free inventory", inventory.valuesIncluded === false && JSON.stringify(inventory).includes("LIVEKIT_API_SECRET")],
  ["three isolated environments", ["development", "staging", "production"].every((name) => inventory.environments[name]) && inventory.environments.staging.githubEnvironment !== inventory.environments.production.githubEnvironment],
  ["development cannot promote", inventory.environments.development.promotionAllowed === false],
  ["primary and backup role domains", owners.roles.length === 8 && owners.roles.every((entry) => entry.primaryRole && entry.backupRole)],
  ["truthful private owner blocker", owners.status === "UNASSIGNED_RELEASE_BLOCKER" && docs.includes("UNASSIGNED_RELEASE_BLOCKER")],
  ["overlapping key rotation", rotate.includes('"phase": "overlap"') && rotate.includes("PICOM_ROTATION_VALIDATION_EVIDENCE") && rotate.includes("oldKeys")],
  ["compromised key rollback forbidden", rotate.includes("Rollback to a compromised key is forbidden")],
  ["Supabase env-file secret transport", rotate.includes("supabase secrets set") && rotate.includes("--env-file") && !rotate.includes("LIVEKIT_API_SECRET=$")],
  ["backend-only emergency gate", emergency.includes("PICOM_V1_VOICE_SCREEN_ENABLED=false") && !emergency.includes("disableFeed") && !emergency.includes("disableChat") && !emergency.includes("disableDirectMessages")],
  ["environment mix artifact scan", mix.includes("server secret exposed through Vite name") && mix.includes("non-production LiveKit endpoint in production artifact")],
  ["protected GitHub environments documented", docs.includes("hosted-staging") && docs.includes("production-release") && docs.includes("CI_DEPLOYMENT_NOT_APPROVED")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted LiveKit secret custody contract passed.");
