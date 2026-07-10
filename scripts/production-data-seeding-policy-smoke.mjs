import { readFileSync } from "node:fs";

const policy = readFileSync("docs/production-data-seeding-policy.md", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");
const admin = readFileSync("docs/admin-user-bootstrap.md", "utf8");
const productionRunbook = readFileSync("docs/production-migration-runbook.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");

const required = [
  "Production seed default: empty",
  "Owner",
  "Admin",
  "Moderator",
  "Member",
  "Guest",
  "Information",
  "Channels",
  "Music & Bots",
  "General",
  "Work Space",
  "Idempotency and transaction rules",
  "Admin bootstrap is separate",
  "on conflict",
];
const failed = required.filter((marker) => !policy.includes(marker));
if (!seed.includes("LOCAL RESET ONLY") || !seed.includes("Development only")) failed.push("local seed guard header");
if (!admin.includes("must not automatically create privileged users") || !admin.includes("refuses raw password")) failed.push("separate admin bootstrap safety");
if (/db push\s+--include-seed/i.test(productionRunbook)) failed.push("production runbook includes remote seed command");
if (/"[^\"]*(?:production|deploy)[^\"]*"\s*:\s*"[^\"]*(?:seed.sql|--include-seed)/i.test(packageJson)) failed.push("production package script can deploy seed data");
if (failed.length) throw new Error(`Production seed policy failed: ${failed.join(", ")}`);
console.log("Production empty-seed, local fixture guard, transactional defaults, idempotency, and separate admin bootstrap policy passed.");
