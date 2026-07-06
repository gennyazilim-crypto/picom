import fs from "node:fs";

const doc = fs.readFileSync("docs/database-restore-drill.md", "utf8");
const required = [
  "Drill purpose",
  "Staging restore steps",
  "Expected duration placeholder",
  "Validation queries",
  "Application smoke test after restore",
  "Rollback if restore fails",
  "Data integrity checks",
  "Approval placeholder",
  "Frequency placeholder",
  "Auth login works",
  "Communities load",
  "Channels load",
  "Recent messages load",
  "Upload metadata exists",
  "Roles/permissions load",
  "Audit logs load",
  "Do not run restore drills against production by default",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Database restore drill runbook is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Database restore drill smoke test passed.");
