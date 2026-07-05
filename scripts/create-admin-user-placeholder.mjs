import { getArgValue, printMaintenanceResult, requireDestructiveConfirmation, requireDevelopmentDefault } from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("create-admin-user-placeholder");
requireDestructiveConfirmation("create-admin-user-placeholder", "--confirm-create-admin");

const email = getArgValue("--email");
if (!email) {
  throw new Error("Missing --email=admin@example.com.");
}

printMaintenanceResult("Create admin user placeholder", {
  mode: "guarded_placeholder",
  email,
  passwordLogged: false,
  nextStep: "Use Supabase Auth admin API or SQL bootstrap migration with secure password hashing.",
});
