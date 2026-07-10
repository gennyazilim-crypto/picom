import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const license = read("LICENSE");
const notices = read("THIRD_PARTY_NOTICES.md");
const docs = read("docs/licenses.md");
const generated = read("THIRD_PARTY_LICENSES.generated.md");

for (const expected of [
  "not selected a final",
  "not be treated as a final legal license grant",
  "Third-party notices",
]) {
  assertIncludes(license, expected, "LICENSE placeholder");
}

for (const expected of [
  "Coolicons",
  "Kryston Schwarze",
  "CC BY 4.0",
  "https://github.com/krystonschwarze/coolicons",
  "Figma community file",
  "Automated dependency inventory",
  "npm run licenses:check",
  "Do not bundle proprietary assets",
]) {
  assertIncludes(notices, expected, "third-party notices");
}

for (const expected of [
  "license not finalized",
  "Coolicons PRO is not approved",
  "no Discord branding",
  "Final project license selection",
]) {
  assertIncludes(docs, expected, "licenses docs");
}

for (const expected of [
  "Generated third-party dependency license inventory",
  "Missing license metadata: 0",
  "Explicit blocked/proprietary expressions: 0",
  "Coolicons",
]) {
  assertIncludes(generated, expected, "generated dependency license report");
}

console.log("License and third-party notices smoke test passed.");
