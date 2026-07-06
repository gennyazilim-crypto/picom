import fs from "node:fs";

const doc = fs.readFileSync("docs/secrets-management.md", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");

const required = [
  "AUTH_SECRET",
  "database password",
  "Redis password",
  "Object storage access keys",
  "Email provider credentials",
  "Signing certificates",
  "Desktop updater keys",
  "Crash reporting DSN",
  "local development",
  "CI secrets placeholder",
  "Production secret manager placeholder",
  "Rotation process",
  "Emergency secret rotation",
  "What must never be committed",
  "How to audit for leaked secrets",
];

const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  console.error(`Secrets management plan is missing: ${missing.join(", ")}`);
  process.exit(1);
}

if (!readme.includes("docs/secrets-management.md")) {
  console.error("README does not reference docs/secrets-management.md.");
  process.exit(1);
}

if (!envExample.includes("Do not commit real secrets")) {
  console.error(".env.example does not clearly warn against committing real secrets.");
  process.exit(1);
}

console.log("Secrets management plan smoke test passed.");
