import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-admin-console.md", "utf8");
const required = [
  "Documentation-only placeholder",
  "No enterprise admin console UI is added",
  "Future sections",
  "Access model",
  "Security boundaries",
  "Audit requirements",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise admin console placeholder missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise admin console placeholder smoke test passed.");
