import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-data-retention-policy.md", "utf8");
const required = [
  "Policy placeholder only",
  "No destructive background job is enabled",
  "Data categories",
  "Legal hold interaction",
  "Destructive job requirements",
  "Desktop behavior",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise data retention policy missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise data retention policy smoke test passed.");
