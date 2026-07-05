import { getArgValue, printMaintenanceResult, redactConnectionString, requireDestructiveConfirmation, requireDevelopmentDefault } from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("db-restore-placeholder");
requireDestructiveConfirmation("db-restore-placeholder", "--confirm-restore");

const backup = getArgValue("--backup");
if (!backup) {
  throw new Error("Missing --backup=path/to/backup.dump.");
}

printMaintenanceResult("Database restore placeholder", {
  mode: "guarded_dry_run_placeholder",
  backup,
  databaseUrl: redactConnectionString(process.env.DATABASE_URL),
  nextStep: "Restore into a temporary/staging database first, then run smoke tests.",
});
