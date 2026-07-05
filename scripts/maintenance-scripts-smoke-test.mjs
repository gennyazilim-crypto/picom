import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/lib/maintenance-guards.mjs",
  "scripts/db-backup-placeholder.mjs",
  "scripts/db-restore-placeholder.mjs",
  "scripts/cleanup-expired-invites.mjs",
  "scripts/cleanup-orphaned-uploads.mjs",
  "scripts/check-storage.mjs",
  "scripts/check-health.mjs",
  "scripts/create-admin-user-placeholder.mjs",
  "scripts/reset-dev-data.mjs",
  "docs/backend-maintenance-scripts.md",
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  throw new Error(`Missing maintenance files: ${missing.join(", ")}`);
}

const restore = readFileSync("scripts/db-restore-placeholder.mjs", "utf8");
const reset = readFileSync("scripts/reset-dev-data.mjs", "utf8");
const admin = readFileSync("scripts/create-admin-user-placeholder.mjs", "utf8");
const docs = readFileSync("docs/backend-maintenance-scripts.md", "utf8");

const checks = [
  [restore.includes("requireDestructiveConfirmation"), "restore guarded"],
  [reset.includes("requireDestructiveConfirmation"), "reset guarded"],
  [admin.includes("passwordLogged: false"), "admin password not logged"],
  [docs.includes("Destructive scripts are guarded"), "docs destructive guard"],
  [docs.includes("No production secrets"), "docs no secrets"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Maintenance scripts smoke test failed: ${failed.join(", ")}`);
}

console.log("Backend maintenance scripts smoke test passed.");
