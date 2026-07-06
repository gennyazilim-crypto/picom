import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-deployment-model.md", "utf8");
const required = [
  "Documentation-only deployment model",
  "Staging",
  "Beta",
  "Production",
  "Verification checklist",
  "Rollback model",
  "Known risks",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise deployment model missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise deployment model smoke test passed.");
