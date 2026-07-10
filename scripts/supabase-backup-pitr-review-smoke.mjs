import { readFileSync } from "node:fs";

const review = readFileSync("docs/supabase-backup-pitr-review.md", "utf8");
const checkpoint = readFileSync("docs/task-checkpoints/task-319-supabase_backup_and_pitr_review.md", "utf8");
const required = [
  "Free",
  "Pro",
  "Team",
  "Enterprise",
  "7 days",
  "14 days",
  "30 days",
  "Point-in-Time Recovery",
  "Small compute",
  "Storage objects are not included",
  "Spend Cap",
  "Restore drill",
  "PENDING APPROVAL",
  "2026-07-10",
  "supabase.com/docs/guides/platform/backups",
];
const missing = required.filter((marker) => !review.includes(marker));
if (!checkpoint.includes("No production Supabase setting was changed")) missing.push("checkpoint no-change boundary");
if (missing.length) throw new Error(`Supabase backup/PITR review missing: ${missing.join(", ")}`);
console.log("Supabase backup tier, PITR cost, Storage limitation, restore drill, and no-change review passed.");
