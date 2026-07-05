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

const doc = read("docs/enterprise-readiness.md");

for (const expected of [
  "Enterprise Readiness Report",
  "not enterprise-ready yet",
  "SSO",
  "SCIM",
  "audit log",
  "Data retention",
  "Admin controls",
  "Security controls",
  "Deployment options",
  "Backup and restore",
  "Monitoring and support",
  "Compliance gaps",
  "Roadmap to enterprise readiness",
]) {
  assertIncludes(doc, expected, "enterprise readiness docs");
}

for (const forbidden of [
  /service_role/i,
  /password\s*=/i,
  /secret\s*=/i,
  /certificate\s*=/i,
]) {
  assertNotMatches(doc, forbidden, "enterprise readiness docs");
}

console.log("Enterprise readiness report smoke test passed.");
