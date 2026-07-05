import fs from "node:fs";

function exists(path) {
  return fs.existsSync(path);
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

for (const required of ["src", "electron", "supabase", "scripts", "docs", "package.json"]) {
  if (!exists(required)) {
    throw new Error(`Expected current package boundary path missing: ${required}`);
  }
}

const doc = read("docs/package-boundaries.md");
for (const expected of [
  "single-package repository",
  "Current structure",
  "Current boundaries",
  "Why not migrate now",
  "Future monorepo target",
  "apps/",
  "packages/",
  "Risky cleanup deferred",
  "Keep the current single-package layout for MVP",
]) {
  assertIncludes(doc, expected, "package boundary docs");
}

console.log("Package boundary review smoke test passed.");
