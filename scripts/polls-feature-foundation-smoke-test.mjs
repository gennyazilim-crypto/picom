import fs from "node:fs";

const doc = fs.readFileSync("docs/polls-feature-foundation.md", "utf8");
const required = [
  "post-MVP foundation",
  "polls",
  "poll_options",
  "poll_votes",
  "RLS",
  "enablePolls",
  "documentation-first"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Polls foundation doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Polls feature foundation smoke passed.");
