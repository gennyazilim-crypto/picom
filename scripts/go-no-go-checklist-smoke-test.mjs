import fs from "node:fs";

const doc = fs.readFileSync("docs/go-no-go-checklist.md", "utf8");
const required = [
  "product readiness",
  "desktop UI readiness",
  "backend readiness",
  "database readiness",
  "realtime readiness",
  "packaging readiness",
  "security readiness",
  "support readiness",
  "monitoring readiness",
  "rollback readiness",
  "known issues",
  "final decision",
  "Go with known non-blockers",
  "No-Go",
  "Delay pending blocker fix",
  "Product",
  "Engineering",
  "Security",
  "Operations",
  "Support",
  "docs/production-deployment-checklist.md",
  "docs/staging-smoke-test.md",
  "docs/rollback-runbook.md",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Go/No-Go checklist is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Go/No-Go checklist smoke test passed.");
