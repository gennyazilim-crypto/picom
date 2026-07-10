import { readFile, readdir } from "node:fs/promises";

const [doc, decision, packageJson, checkpointNames] = await Promise.all([
  readFile("docs/release/final-v2-readiness-audit.md", "utf8"),
  readFile("docs/release/stable-v2-go-no-go.md", "utf8"),
  readFile("package.json", "utf8"),
  readdir("docs/task-checkpoints"),
]);

const missing = [];
for (let task = 151; task <= 249; task += 1) {
  if (!checkpointNames.some((name) => name.startsWith(`task-${task}-`))) missing.push(task);
}
const normalizedDoc = doc.toLowerCase();
const checks = [
  [missing.length === 0, `checkpoint coverage missing: ${missing.join(",")}`],
  [doc.includes("all 99 source tasks from 151 through 249") && doc.includes("No-Go for public stable v2"), "scope and decision"],
  [doc.includes("npm run qa:smoke") && doc.includes("npm run supabase:smoke") && doc.includes("npm run typecheck") && doc.includes("npm run build"), "verification evidence"],
  [doc.includes("Critical release blockers") && normalizedDoc.includes("external security review") && normalizedDoc.includes("accessibility audit") && normalizedDoc.includes("backup restore"), "blockers"],
  [doc.includes("High risks and technical debt") && doc.includes("Deno Edge Functions") && doc.includes("bundle size"), "risks"],
  [doc.includes("Conditional non-blockers") && doc.includes("auto-update") && doc.includes("marketplace/plugin runtime"), "non-blockers"],
  [doc.includes("Recommended next 10 priorities") && doc.includes("What should not be enabled yet"), "priorities and exclusions"],
  [decision.includes("final-v2-readiness-audit.md") && packageJson.includes('"release:v2:readiness:audit:smoke"'), "linked gate"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
