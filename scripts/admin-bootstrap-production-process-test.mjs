import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710004600_admin_operations_access.sql", "utf8");
const adminV2 = readFileSync("supabase/migrations/20260710198000_admin_operations_v2.sql", "utf8");
const service = readFileSync("src/services/adminOperationsService.ts", "utf8");
const placeholder = readFileSync("scripts/create-admin-user-placeholder.mjs", "utf8");
const preflight = readFileSync("scripts/admin-bootstrap-production-preflight.mjs", "utf8");
const docs = readFileSync("docs/admin-bootstrap.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

const checks = [
  [migration.includes("revoke all on public.app_admins from anon, authenticated") && migration.includes("renderer has no mutation route"), "protected app_admins table"],
  [migration.includes("security definer") && migration.includes("grant execute on function public.is_app_admin() to authenticated"), "protected app-admin lookup"],
  [adminV2.includes("APP_ADMIN_REQUIRED") && adminV2.includes("revoke all on public.admin_operations_audit"), "server-side admin RPC/audit guards"],
  [service.includes('client.rpc("is_app_admin")') && service.includes('source: "none"'), "renderer fail-closed access"],
  [placeholder.includes("requireDestructiveConfirmation") && placeholder.includes("rawPasswordAccepted: false"), "development placeholder confirmation/password ban"],
  [preflight.includes("PICOM_APP_ADMIN_BOOTSTRAP_REVIEWED") && preflight.includes("sqlExecuted: false") && preflight.includes("passwordAccepted: false"), "production non-mutating preflight"],
  [docs.includes("No automatic production admin creation") && docs.includes("Two-person approval") && docs.includes("Community admin bootstrap"), "final process documentation"],
  [docs.includes("Revoke app-admin") && docs.includes("Do not accept or log passwords"), "revocation and secret safety"],
];
for (const scriptName of ["predev", "dev", "postinstall", "build", "package", "prepare"]) {
  if (/create-admin|bootstrap.*admin/i.test(packageJson.scripts?.[scriptName] ?? "")) checks.push([false, `automatic admin creation in ${scriptName}`]);
}
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Admin bootstrap production process failed: ${failed.join(", ")}`);
console.log("App/community admin separation, explicit confirmation, no-password, protected flag, audit, and no-auto-bootstrap contract passed.");
