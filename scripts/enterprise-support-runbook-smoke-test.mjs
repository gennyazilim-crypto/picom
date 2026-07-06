import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-support-runbook.md", "utf8");
const required = [
  "Operational runbook",
  "Support principles",
  "Intake checklist",
  "Severity levels",
  "Triage by area",
  "Redaction requirements",
  "Closure checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise support runbook missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise support runbook smoke test passed.");
