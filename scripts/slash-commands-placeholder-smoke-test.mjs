import fs from "node:fs";

const doc = fs.readFileSync("docs/slash-commands-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "not enabled",
  "must not execute arbitrary code",
  "typed registry",
  "enableSlashCommands",
  "desktop-native"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Slash commands placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Slash commands placeholder smoke passed.");
