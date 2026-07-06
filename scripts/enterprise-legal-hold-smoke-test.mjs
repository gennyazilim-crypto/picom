import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-legal-hold.md", "utf8");
const required = [
  "Placeholder only",
  "Preservation is not authorization",
  "Scope model placeholder",
  "Retention interaction",
  "Export interaction",
  "Audit events",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise legal hold doc missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise legal hold placeholder smoke test passed.");
