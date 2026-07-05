import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

function assertNotMatches(text, pattern, label) {
  if (pattern.test(text)) {
    throw new Error(`${label} contains forbidden pattern: ${pattern}`);
  }
}

const doc = read("docs/api-compatibility.md");

for (const expected of [
  "API Deprecation and Compatibility Policy",
  "semantic versioning",
  "breaking change",
  "Additive change policy",
  "Deprecation headers placeholder",
  "Error shape compatibility",
  "Pagination compatibility",
  "Realtime event compatibility",
  "Desktop auto-update relationship",
  "Emergency exceptions",
  "Release checklist impact",
  "Supabase",
  "LiveKit",
]) {
  assertIncludes(doc, expected, "API compatibility docs");
}

for (const forbidden of [
  /service_role/i,
  /password\s*=/i,
  /secret\s*=/i,
  /sk_live/i,
]) {
  assertNotMatches(doc, forbidden, "API compatibility docs");
}

console.log("API deprecation and compatibility policy smoke test passed.");
