import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/dependency-management.md");
const pkg = JSON.parse(read("package.json"));

for (const expected of [
  "Dependency Audit and Update Plan",
  "npm audit --audit-level=moderate",
  "npm outdated",
  "Electron",
  "Supabase",
  "LiveKit",
  "Do not run broad automatic upgrades",
  "contextIsolation: true",
  "nodeIntegration: false",
  "Never expose LiveKit API secrets",
]) {
  assertIncludes(doc, expected, "dependency management docs");
}

for (const expected of [
  "electron",
  "electron-builder",
  "@supabase/supabase-js",
  "livekit-client",
  "vite",
  "typescript",
]) {
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (!allDeps[expected]) {
    throw new Error(`package.json missing expected dependency: ${expected}`);
  }
}

console.log("Dependency audit and update plan smoke test passed.");
