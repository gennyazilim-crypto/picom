import fs from "node:fs";

const doc = fs.readFileSync("docs/incident-response.md", "utf8");
const required = [
  "backend down",
  "Database unavailable",
  "Redis unavailable",
  "Realtime outage",
  "Login failure spike",
  "Message send failure",
  "Upload outage",
  "Corrupted release",
  "Bad desktop update",
  "Security incident placeholder",
  "Data loss suspected",
  "Private channel access leak suspected",
  "First 15 minutes checklist",
  "First hour checklist",
  "Post-incident review template",
  "Symptoms",
  "Mitigation",
  "Rollback",
  "Communication",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Incident response runbook is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Incident response runbook smoke test passed.");
