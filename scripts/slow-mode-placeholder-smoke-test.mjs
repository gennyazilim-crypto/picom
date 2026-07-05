import fs from "node:fs";

const doc = fs.readFileSync("docs/slow-mode-placeholder.md", "utf8");
const required = [
  "post-MVP",
  "Staging assumptions",
  "Beta assumptions",
  "Production assumptions",
  "Rollback plan",
  "Known risks",
  "enableSlowMode",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Slow mode placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Slow mode placeholder smoke passed.");
