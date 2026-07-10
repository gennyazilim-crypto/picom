import { readFile } from "node:fs/promises";

const [config, docs, workflow, packageText] = await Promise.all([
  readFile(".github/dependabot.yml", "utf8"),
  readFile("docs/dependency-update-train.md", "utf8"),
  readFile(".github/workflows/qa.yml", "utf8"),
  readFile("package.json", "utf8"),
]);
const checks = [
  [config.includes("interval: monthly") && config.includes("open-pull-requests-limit: 4"), "bounded monthly update train"],
  [config.includes("routine-patches") && config.includes("electron-patches") && config.includes("supabase-patches") && config.includes("livekit-patches"), "risk-specific patch groups"],
  [config.includes("version-update:semver-minor") && config.includes("version-update:semver-major"), "minor and major updates ignored automatically"],
  [!config.includes("auto-merge") && !config.includes("interval: daily"), "no auto-merge or daily churn"],
  [docs.includes("No automatic merge") && docs.includes("Rollback") && docs.includes("Electron patch train") && docs.includes("Supabase patch train") && docs.includes("LiveKit patch train"), "review and rollback policy documented"],
  [workflow.includes("dependency:update:train:smoke") && packageText.includes('"dependency:update:train:smoke"'), "CI validates train configuration"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
