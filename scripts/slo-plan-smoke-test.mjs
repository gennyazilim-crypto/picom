import fs from "node:fs";

const doc = fs.readFileSync("docs/slo.md", "utf8");
const required = [
  "Backend API uptime",
  "Auth success rate",
  "Message send success rate",
  "Realtime connection stability",
  "Attachment upload success rate",
  "Desktop crash-free sessions placeholder",
  "Notification delivery placeholder",
  "Database availability",
  "Redis availability",
  "Object storage availability",
  "Target",
  "Measurement method",
  "Alert threshold placeholder",
  "User impact",
  "Owner placeholder",
  "Rollback criteria",
];

const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`SLO plan is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("SLO plan smoke test passed.");
