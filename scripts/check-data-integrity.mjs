import fs from "node:fs";

const isSmoke = process.argv.includes("--smoke");
const wantsFix = process.argv.includes("--fix");
const docPath = "docs/data-corruption-detection.md";

if (isSmoke) {
  const doc = fs.readFileSync(docPath, "utf8");
  const required = [
    "Messages without valid channel",
    "Channels without valid community",
    "Community members without valid user",
    "Roles missing default Member role",
    "Communities without owner",
    "Attachments without message",
    "Read states pointing to invalid channels",
    "Duplicate `clientMessageId`",
    "Invalid permission JSON",
    "Orphaned uploads",
    "read-only by default",
    "Auto-fix must never run without explicit confirmation",
  ];
  const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase().replace(/`/g, "")) && !doc.toLowerCase().includes(item.toLowerCase()));
  if (missing.length > 0) {
    console.error(`Data corruption detection plan is missing: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Data corruption detection smoke test passed.");
  process.exit(0);
}

console.log("Picom data integrity check placeholder");
console.log("Mode: read-only dry run. No database connection is opened by this placeholder.");

if (wantsFix && process.env.PICOM_DATA_INTEGRITY_FIX_CONFIRM !== "reviewed-manual-fix") {
  console.log("Refusing --fix without PICOM_DATA_INTEGRITY_FIX_CONFIRM=reviewed-manual-fix.");
  process.exit(0);
}

const checks = [
  "messages without valid channel",
  "channels without valid community",
  "community members without valid user",
  "roles missing default Member role",
  "communities without owner",
  "attachments without message",
  "read states pointing to invalid channels",
  "duplicate clientMessageId values",
  "invalid permission JSON",
  "orphaned uploads",
];

for (const check of checks) {
  console.log(`- ${check}`);
}

console.log("Future implementation should execute these checks read-only against staging/production with explicit target selection.");
