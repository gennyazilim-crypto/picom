import fs from "node:fs";

const doc = fs.readFileSync("docs/plugin-system.md", "utf8");
const required = [
  "post-MVP architecture document",
  "No dynamic code loading",
  "No arbitrary JavaScript execution",
  "Forbidden capabilities",
  "Permissions model placeholder",
  "Sandboxing approach placeholder",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Plugin system architecture doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Plugin system architecture smoke passed.");
