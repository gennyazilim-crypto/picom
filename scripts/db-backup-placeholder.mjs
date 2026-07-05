import { getArgValue, printMaintenanceResult, redactConnectionString, requireDevelopmentDefault } from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("db-backup-placeholder");

const output = getArgValue("--output") || "backups/picom-backup-placeholder.dump";

printMaintenanceResult("Database backup placeholder", {
  mode: "dry_run_placeholder",
  output,
  databaseUrl: redactConnectionString(process.env.DATABASE_URL),
  nextStep: "Wire pg_dump or managed Supabase backup export in production runbooks.",
});
