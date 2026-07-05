import {
  getArgValue,
  hasFlag,
  printMaintenanceResult,
  requireDestructiveConfirmation,
  requireDevelopmentDefault
} from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("create-admin-user-placeholder");
requireDestructiveConfirmation("create-admin-user-placeholder", "--confirm-create-admin");

const email = getArgValue("--email");
if (!email) {
  throw new Error("Missing --email=admin@example.com.");
}

if (hasFlag("--password") || getArgValue("--password")) {
  throw new Error("Do not pass raw passwords to this placeholder. Use Supabase Auth admin invite/reset flows when the real bootstrap is implemented.");
}

const displayName = getArgValue("--display-name") || "Picom Admin";
const role = getArgValue("--role") || "app_admin";

printMaintenanceResult("Create admin user placeholder", {
  mode: "guarded_placeholder",
  email,
  displayName,
  role,
  appAdminFlag: "placeholder_requires_backend_app_admins_table",
  authProvider: "supabase_auth_admin_api_placeholder",
  passwordLogged: false,
  rawPasswordAccepted: false,
  nextStep: "Create/invite the user through Supabase Auth, then grant app-admin status through a restricted operator-only app_admins table.",
});
