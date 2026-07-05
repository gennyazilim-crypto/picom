import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/long-term-architecture-review.md");

for (const expected of [
  "Final Long-Term Architecture Review",
  "Strong areas",
  "Weak areas",
  "Technical debt",
  "Refactor candidates",
  "Risky modules",
  "Scalability considerations",
  "Recommended next 10 tasks",
  "What should not be built yet",
  "Mobile app or mobile layout",
  "Supabase",
  "LiveKit",
  "Electron",
]) {
  assertIncludes(doc, expected, "long-term architecture review");
}

console.log("Long-term architecture review smoke test passed.");
