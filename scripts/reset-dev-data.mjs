import { printMaintenanceResult, requireDestructiveConfirmation } from "./lib/maintenance-guards.mjs";

requireDestructiveConfirmation("reset-dev-data", "--confirm-reset-dev-data");

printMaintenanceResult("Reset development data placeholder", {
  mode: "guarded_placeholder",
  environment: process.env.NODE_ENV ?? "development",
  nextStep: "Clear local mock cache and reseed Supabase development tables only after explicit confirmation.",
});
