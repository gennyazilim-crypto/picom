import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const packageJson = JSON.parse(read("package.json"));
const requiredScripts = [
  "community:access:smoke", "community:role-permissions:smoke", "community:role-management:smoke", "community:member-roles:smoke",
  "community:structure:smoke", "community:invites-access:smoke", "invites:acceptance:production:test", "community:public-join:production:test",
  "community:moderation:full:smoke", "community:audit:viewer:test", "community:audit-danger:full:smoke", "community:ownership-transfer:smoke",
  "community:delete-safety:smoke", "community:settings-branding:full:smoke", "community:kind-full-mvp:qa",
];
for (const script of requiredScripts) if (typeof packageJson.scripts?.[script] !== "string") throw new Error(`FAIL missing QA script: ${script}`);

const files = {
  menu: read("src/components/CommunityMenu.tsx"),
  deferred: read("src/components/CommunityAdminDeferredSection.tsx"),
  permissions: read("src/services/permissions/communityPermissions.ts"),
  roles: read("src/components/community/CommunityRoleManagement.tsx"),
  assignments: read("src/components/community/CommunityMemberRoleAssignment.tsx"),
  structure: read("src/components/CommunityStructureManagementPanel.tsx"),
  invites: read("src/components/community/CommunityInviteManagement.tsx"),
  moderation: read("src/components/community/CommunityModerationCenter.tsx"),
  audit: read("src/components/CommunityAuditLogSection.tsx"),
  transfer: read("src/components/CommunityOwnershipTransferPanel.tsx"),
  archive: read("src/components/CommunityDeleteSafetyPanel.tsx"),
  settings: read("src/components/community/CommunitySettingsEditor.tsx"),
  roleMigration: read("supabase/migrations/20260711149400_member_multi_role_assignment.sql"),
  structureMigration: read("supabase/migrations/20260711149500_type_aware_community_structure_management.sql"),
  moderationMigration: read("supabase/migrations/20260711149700_community_moderation_reports_completion.sql"),
  dangerMigration: read("supabase/migrations/20260711149800_community_audit_danger_zone_completion.sql"),
  settingsMigration: read("supabase/migrations/20260711149900_community_settings_branding_type_configuration.sql"),
  visual: read("tests/visual/visual-regression-manifest.json"),
  e2e: read("tests/e2e/e2e-coverage-manifest.json"),
};

const checks = [
  ["five access states", ["owner", "admin", "moderator", "member", "visitor"].every((status) => files.permissions.includes(`\"${status}\"`))],
  ["custom role hierarchy", files.roles.includes("Create role") && files.roles.includes("Move up") && files.roleMigration.includes("ROLE_HIERARCHY_DENIED")],
  ["multi-role assignment", files.assignments.includes("roleIds") && files.roleMigration.includes("set_community_member_roles")],
  ["three-kind structure", ["text", "radio", "podcast"].every((kind) => files.structureMigration.includes(`'${kind}'`)) && files.structure.includes("community.kind")],
  ["invite and visitor boundaries", files.invites.includes("Revoke") && files.menu.includes("Join Community") && files.menu.includes("Invite required")],
  ["moderation and reports", ["timeout", "kick", "ban", "unban", "untimeout"].every((action) => files.moderation.includes(action)) && files.moderationMigration.includes("ROLE_HIERARCHY_DENIED")],
  ["audit is read-only", files.audit.includes("Actor") && files.audit.includes("Target") && !/updateRecord|deleteRecord|editAudit/.test(files.audit)],
  ["ownership and archive confirmations", files.transfer.includes('current-password') && files.archive.includes('current-password') && files.dangerMigration.includes("community_member_roles")],
  ["branding rules and kinds", files.settings.includes("Banner upload") && files.settings.includes("Rules and join acceptance") && files.settingsMigration.includes("valid_community_type_settings")],
  ["service-only admin UI", [files.roles, files.assignments, files.structure, files.invites, files.moderation, files.settings].every((source) => !source.includes("getSupabaseClient") && !source.includes("supabase.from"))],
  ["no acceptance placeholder", [files.moderation, files.structure, files.invites, files.settings, files.transfer, files.archive].every((source) => !/coming soon|placeholder opened|timeout placeholder/i.test(source))],
  ["active routes", files.menu.includes("CommunityModerationCenter") && files.deferred.includes('mode="all"') && files.menu.includes("CommunitySettingsSection")],
  ["visual contract matrix", files.visual.includes("owner_text") && files.visual.includes("admin_radio") && files.visual.includes("moderator_podcast") && files.visual.includes("visitor_podcast")],
  ["E2E contract matrix", files.e2e.includes("community-admin-full-mvp") && requiredScripts.slice(0, 5).every((script) => packageJson.scripts[script])],
];
for (const [label, pass] of checks) { if (!pass) throw new Error(`FAIL ${label}`); console.log(`PASS ${label}`); }
console.log(`Community Administration Full MVP QA contract passed with ${requiredScripts.length} required feature gates.`);
