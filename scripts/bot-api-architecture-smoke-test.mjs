import fs from "node:fs";

const doc = fs.readFileSync("docs/bot-api.md", "utf8");
const required = [
  "post-MVP architecture document",
  "Bot authentication model",
  "token_hash",
  "Rate limits",
  "Events bots can receive",
  "Webhook comparison",
  "Developer portal placeholder",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Bot API architecture doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Bot API architecture smoke passed.");
