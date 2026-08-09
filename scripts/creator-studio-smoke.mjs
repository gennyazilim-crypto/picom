/**
 * Static smoke for TASK33 Creator Studio team RBAC / invites / finance isolation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migrations = [
  "supabase/migrations/20260808390000_creator_studio_team_core.sql",
  "supabase/migrations/20260808400000_creator_studio_roles_permissions.sql",
  "supabase/migrations/20260808410000_creator_studio_security_audit.sql",
  "supabase/migrations/20260808420000_creator_studio_hardening.sql",
];
for (const file of migrations) assert.ok(existsSync(path.join(root, file)), file);

const core = read(migrations[0]);
const roles = read(migrations[1]);
const audit = read(migrations[2]);
const hard = read(migrations[3]);

assert.match(core, /publisher_team_members/);
assert.match(core, /publisher_team_invitations/);
assert.match(core, /token_hash/);
assert.match(core, /finance\.approve/);
assert.doesNotMatch(core, /service_role.*grant.*authenticated/i);

assert.match(roles, /FINANCE_MANAGER/);
assert.match(roles, /publisher_studio_has_permission/);
assert.match(roles, /get_my_publisher_studio_context/);
assert.match(roles, /ensure_publisher_studio_builtin_roles/);
// Manager must not get finance.approve in seed grants block for MANAGER
const managerBlock = roles.slice(roles.indexOf("MANAGER: ops"), roles.indexOf("FINANCE_MANAGER"));
assert.doesNotMatch(managerBlock, /finance\.approve/);
assert.doesNotMatch(managerBlock, /'finance\.read'/);

assert.match(audit, /create_publisher_team_invitation/);
assert.match(audit, /accept_publisher_team_invitation/);
assert.match(audit, /CANNOT_REMOVE_OWNER/);
assert.match(audit, /OWNER_INVARIANT/);
assert.match(audit, /INVITE_RATE_LIMITED/);

assert.match(hard, /publisher_studio_require_recent_auth/);
assert.match(hard, /OWNER_ROLE_IMMUTABLE/);
assert.match(hard, /get_my_publisher_studio_readiness/);
assert.match(hard, /PROVIDER_NOT_CONFIGURED|BLOCKED_CONTENT_APPROVAL/);

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enableCreatorStudio/);
assert.match(flags, /enableCreatorStudio:\s*appConfig\.environment !== "production"/);

const edge = read("supabase/functions/client-config/index.ts");
assert.match(edge, /enableCreatorStudio/);

const ui = read("src/components/publisher/PublisherCreatorStudioWorkspace.tsx");
assert.match(ui, /PublisherDashboardWorkspace/);
assert.match(ui, /studioEnabled/);
assert.match(ui, /financeWarning/);
assert.match(ui, /sessionManagementService/);

const catalog = read("src/services/localization/creatorStudioCatalog.ts");
assert.match(catalog, /const ar:/i);
assert.match(catalog, /studio\.financeAccess/);
assert.match(catalog, /studio\.providerNotConfigured/);

const svc = read("src/services/publisher/publisherStudioService.ts");
assert.match(svc, /sha256Hex/);
assert.match(svc, /plaintextTokenOnce/);
assert.doesNotMatch(svc, /console\.log\(.*plaintext/);

console.log("creator-studio-smoke: PASS");
