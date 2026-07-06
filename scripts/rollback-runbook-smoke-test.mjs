import fs from "node:fs";

const doc = fs.readFileSync("docs/rollback-runbook.md", "utf8");
const checklist = fs.readFileSync("docs/production-deployment-checklist.md", "utf8");
const required = [
  "Backend rollback",
  "Database migration rollback limitations",
  "Desktop app rollback",
  "Auto-update rollback placeholder",
  "Feature flag rollback",
  "Emergency kill switch usage",
  "Object storage rollback considerations",
  "Realtime compatibility considerations",
  "User communication placeholder",
  "database rollback is not always safe",
  "Verify latest backup exists",
  "Desktop client/server compatibility",
  "docs/safe-rollout.md",
  "docs/incident-response.md",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Rollback runbook is missing: ${missing.join(", ")}`);
  process.exit(1);
}

if (!checklist.includes("docs/rollback-runbook.md")) {
  console.error("Production deployment checklist does not reference rollback runbook.");
  process.exit(1);
}

console.log("Rollback runbook smoke test passed.");
