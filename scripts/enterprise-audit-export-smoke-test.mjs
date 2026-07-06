import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-audit-export.md", "utf8");
const required = [
  "Placeholder architecture only",
  "Future permission model",
  "Excluded export content",
  "Redaction policy",
  "Export lifecycle",
  "Security assumptions",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise audit export doc missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise audit export smoke test passed.");
