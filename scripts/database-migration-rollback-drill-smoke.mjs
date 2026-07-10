import { readFileSync } from "node:fs";

const doc = readFileSync("docs/database-migration-rollback-drill.md", "utf8");
const checkpoint = readFileSync("docs/task-checkpoints/task-320-database_migration_rollback_drill.md", "utf8");
const required = [
  "BLOCKED / NOT RUN",
  "Verified backup gate",
  "Apply candidate migration",
  "Compensating migration",
  "Forward-fix",
  "Restore/PITR",
  "Reapply and roll forward",
  "owner/admin/moderator/member/visitor",
  "Windows, Linux, and macOS",
  "Storage objects",
  "Migration history",
];
const missing = required.filter((marker) => !doc.includes(marker));
for (const forbidden of ["supabase db reset --linked", "supabase migration down --linked", "delete from supabase_migrations.schema_migrations"]) {
  if (doc.toLowerCase().includes(forbidden)) missing.push(`forbidden destructive instruction: ${forbidden}`);
}
if (!checkpoint.includes("No staging or production database was contacted")) missing.push("checkpoint no-contact boundary");
if (missing.length) throw new Error(`Migration rollback drill contract failed: ${missing.join(", ")}`);
console.log("Migration backup, apply, validation, recovery decision, roll-forward, and production safety drill contract passed.");
