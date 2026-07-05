import fs from "node:fs";

const doc = fs.readFileSync("docs/webhook-foundation.md", "utf8");
const required = [
  "post-MVP foundation",
  "No arbitrary code execution",
  "token_hash",
  "Rate limiting",
  "documentation-only",
  "feature flags"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Webhook foundation doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Webhook foundation smoke passed.");
