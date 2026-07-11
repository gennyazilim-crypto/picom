import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711149400_member_multi_role_assignment.sql");
const permissions = read("src/services/permissions/communityPermissions.ts");
const service = read("src/services/community/communityRoleAssignmentService.ts");
const members = read("src/components/community/CommunityAdminSections.tsx");
const app = read("src/App.tsx");

for (const marker of ["not public.has_community_permission(target_community_id,'manageRoles')", "target_position>=actor_position", "requested_position>=actor_position", "OWNER_ROLE_TRANSFER_REQUIRED", "SELF_ROLE_CHANGE_FORBIDDEN", "ROLE_HIERARCHY_DENIED", "for update", "role_change", "redact_audit_reason"]) assert.ok(migration.includes(marker), `missing backend hierarchy boundary: ${marker}`);
assert.ok(permissions.includes("canAssignCommunityRole") && permissions.includes("isOwnerRole(targetRole)") && permissions.includes("getRolePosition(access.role) > getRolePosition(currentTargetRole)"), "frontend hierarchy helper must hide forbidden assignments");
assert.ok(service.includes('rpc("set_community_member_roles"') && service.includes("safeError") && !service.includes('.from("community_members")'), "role assignment must stay behind the service/RPC boundary");
assert.ok(members.includes("CommunityMemberRoleAssignment") && members.includes("onMemberRolesChanged"), "MVP-grade multi-role assignment controls must be present");
assert.ok(app.includes("onMemberRolesChanged") && app.includes("replaceCommunityMembers"), "successful role changes must update app state");
console.log("Community role assignment test: PASS");
