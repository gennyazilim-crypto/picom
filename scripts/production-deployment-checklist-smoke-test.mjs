import fs from "node:fs";

const doc = fs.readFileSync("docs/production-deployment-checklist.md", "utf8");
const required = [
  "environment variables",
  "database migration",
  "database backup verified",
  "Redis connectivity",
  "Object storage connectivity",
  "Backend health",
  "Readiness endpoint",
  "Realtime gateway",
  "Upload validation",
  "Rate limits",
  "CORS",
  "Logging redaction",
  "Admin bootstrap",
  "Monitoring",
  "Rollback plan",
  "Desktop client compatibility",
  "Release notes",
  "Support communication placeholder",
  "[BLOCKER]",
  "docs/incident-response.md",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Production deployment checklist is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Production deployment checklist smoke test passed.");
