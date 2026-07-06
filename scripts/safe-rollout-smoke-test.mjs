import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const rolloutDoc = read("docs/safe-rollout.md");
const releaseChecklist = read("docs/release-checklist.md");

const requiredRolloutPhrases = [
  "Release rings",
  "Internal",
  "Beta small group",
  "Beta all",
  "Stable percentage rollout placeholder",
  "Stable full rollout",
  "Rollback criteria",
  "Crash-free desktop sessions",
  "Backend API error rate",
  "Installer failure",
  "Update pause procedure placeholder",
  "Remote config and updateService alignment",
  "Communication plan placeholder",
  "Known issues handling",
  "Windows, Linux, and macOS",
  "No mobile rollout process",
];

const requiredChecklistPhrases = [
  "Safe rollout ring is selected",
  "docs/safe-rollout.md",
  "Rollback or rollout pause criteria are reviewed",
];

const missing = [];

for (const phrase of requiredRolloutPhrases) {
  if (!rolloutDoc.includes(phrase)) {
    missing.push(`docs/safe-rollout.md missing: ${phrase}`);
  }
}

for (const phrase of requiredChecklistPhrases) {
  if (!releaseChecklist.includes(phrase)) {
    missing.push(`docs/release-checklist.md missing: ${phrase}`);
  }
}

if (missing.length > 0) {
  console.error("Safe rollout smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Safe rollout smoke test passed.");

