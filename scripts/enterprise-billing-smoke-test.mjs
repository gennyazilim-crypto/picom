import fs from "node:fs";

const doc = fs.readFileSync("docs/enterprise-billing.md", "utf8");
const required = [
  "Documentation-only placeholder",
  "No billing provider is integrated",
  "Payment data rules",
  "Entitlements vs permissions",
  "Desktop behavior",
  "Security requirements before implementation",
  "Verification checklist",
];
const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Enterprise billing placeholder missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Enterprise billing placeholder smoke test passed.");
