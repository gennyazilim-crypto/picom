import fs from "node:fs";

const doc = fs.readFileSync("docs/saved-messages-foundation.md", "utf8");
const required = [
  "post-MVP foundation",
  "saved_messages",
  "Supabase/RLS",
  "Save message",
  "enableSavedMessages",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Saved messages foundation doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Saved messages foundation smoke passed.");
