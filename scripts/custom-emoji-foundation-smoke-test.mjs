import fs from "node:fs";

const doc = fs.readFileSync("docs/custom-emoji-foundation.md", "utf8");
const required = [
  "post-MVP foundation",
  "Name normalization",
  "Upload validation",
  "Supabase storage placeholder",
  "manageEmojis",
  "documentation-first"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Custom emoji foundation doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Custom emoji foundation smoke passed.");
