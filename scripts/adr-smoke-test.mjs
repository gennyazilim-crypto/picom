import fs from "node:fs";

const requiredFiles = [
  "docs/adr/0001-desktop-runtime.md",
  "docs/adr/0002-frontend-state-management.md",
  "docs/adr/0003-backend-stack.md",
  "docs/adr/0004-realtime-architecture.md",
  "docs/adr/0005-storage-strategy.md",
  "docs/adr/0006-permissions-model.md",
];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

for (const file of requiredFiles) {
  const text = read(file);
  assertIncludes(text, "Status:", file);
  assertIncludes(text, "Context", file);
  assertIncludes(text, "Decision", file);
  assertIncludes(text, "Consequences", file);
}

const combined = requiredFiles.map(read).join("\n");
for (const expected of [
  "Electron",
  "React + TypeScript",
  "Supabase",
  "Supabase Realtime",
  "Supabase Storage",
  "RLS",
  "Windows, Linux, and macOS",
]) {
  assertIncludes(combined, expected, "ADR set");
}

const readme = read("docs/adr/README.md");
assertIncludes(readme, "Architecture Decision Records", "ADR README");
assertIncludes(readme, "ADR template", "ADR README");

console.log("Architecture Decision Records smoke test passed.");
