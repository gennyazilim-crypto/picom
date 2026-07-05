import { readFileSync } from "node:fs";

const doc = readFileSync("docs/e2ee-architecture.md", "utf8");
const checkpoint = readFileSync("docs/task-checkpoints/task-374-e2ee-architecture-document.md", "utf8");

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

[
  "Picom does **not** currently provide production end-to-end encryption.",
  "No cryptography is implemented in this task.",
  "Metadata that would remain visible",
  "Key management placeholder",
  "Device trust model",
  "Multi-device issues",
  "Search limitations",
  "Moderation limitations",
  "Backup and recovery limitations",
  "Attachment encryption placeholder",
  "Phased implementation plan",
  "Do not market or label current MVP messages as end-to-end encrypted.",
].forEach((needle) => assertIncludes(doc, needle, `E2EE architecture section ${needle}`));

assertIncludes(checkpoint, "No runtime code, crypto code, dependencies, or UI behavior changed.", "checkpoint scope statement");

console.log("E2EE architecture document smoke test passed.");
