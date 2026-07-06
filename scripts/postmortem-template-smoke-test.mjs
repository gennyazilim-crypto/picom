import fs from "node:fs";

const doc = fs.readFileSync("docs/postmortem-template.md", "utf8");
const incident = fs.readFileSync("docs/incident-response.md", "utf8");
const required = [
  "Incident title",
  "Date/time",
  "Severity",
  "Affected users",
  "Affected platforms",
  "Windows",
  "Linux",
  "Affected systems",
  "desktop app",
  "backend",
  "realtime",
  "database",
  "uploads",
  "Timeline",
  "Root cause",
  "Contributing factors",
  "What went well",
  "What went poorly",
  "User impact",
  "Detection method",
  "Resolution",
  "Follow-up actions",
  "Owners",
  "Due dates",
  "Prevention plan",
  "Do not include secrets",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Postmortem template is missing: ${missing.join(", ")}`);
  process.exit(1);
}

if (!incident.includes("docs/postmortem-template.md")) {
  console.error("Incident response runbook does not reference the postmortem template.");
  process.exit(1);
}

console.log("Postmortem template smoke test passed.");
