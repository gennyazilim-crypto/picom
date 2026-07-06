import fs from "node:fs";

const doc = fs.readFileSync("docs/scim-provisioning.md", "utf8");
const required = [
  "Placeholder only",
  "No SCIM server endpoint is implemented",
  "Desktop clients should not call SCIM endpoints",
  "Group-to-role mapping",
  "Security model",
  "Audit events",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`SCIM placeholder missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("SCIM provisioning placeholder smoke test passed.");
