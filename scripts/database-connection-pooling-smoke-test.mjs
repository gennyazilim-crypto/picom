import fs from "node:fs";

const doc = fs.readFileSync("docs/database-connection-pooling.md", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");
const required = [
  "Current behavior",
  "Prisma connection behavior placeholder",
  "Development configuration",
  "Production configuration placeholder",
  "Max connections placeholder",
  "Pooling provider placeholder",
  "Serverless vs long-running backend",
  "Migration connection behavior",
  "Realtime/backend worker usage",
  "Failure symptoms",
  "Monitoring queries placeholder",
  "must not receive direct database credentials",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Database connection pooling plan is missing: ${missing.join(", ")}`);
  process.exit(1);
}

if (envExample.includes("DATABASE_URL=")) {
  console.error(".env.example exposes DATABASE_URL; renderer env should stay database-secret free.");
  process.exit(1);
}

console.log("Database connection pooling plan smoke test passed.");
