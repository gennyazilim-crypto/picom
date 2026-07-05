import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/roadmap.md");

for (const expected of [
  "Picom Product Roadmap",
  "Mobile support is explicitly out of scope",
  "Phase 1 - Desktop UI foundation",
  "Phase 2 - Core chat MVP",
  "Phase 3 - Backend integration",
  "Phase 4 - Realtime and uploads",
  "Phase 5 - Permissions and moderation",
  "Phase 6 - Desktop packaging",
  "Phase 7 - Beta release",
  "Phase 8 - Production hardening",
  "Phase 9 - Advanced community features",
  "Phase 10 - Bot, webhook, and platform features",
  "Phase 11 - Enterprise readiness",
  "Post-MVP only",
  "Long-term, not MVP",
]) {
  assertIncludes(doc, expected, "roadmap docs");
}

console.log("Final roadmap consolidation smoke test passed.");
