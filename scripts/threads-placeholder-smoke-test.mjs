import fs from "node:fs";

const doc = fs.readFileSync("docs/threads-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "threads",
  "parent_message_id",
  "Supabase/RLS",
  "enableThreads",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Threads placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Threads placeholder smoke passed.");
