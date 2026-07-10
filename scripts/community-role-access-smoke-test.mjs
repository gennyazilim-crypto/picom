import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assertIncludes = (content, needle, label) => {
  if (!content.includes(needle)) {
    throw new Error(`${label}: missing ${needle}`);
  }
};

const accessTypes = read("src/types/communityAccess.ts");
const permissions = read("src/services/permissions/communityPermissions.ts");
const menu = read("src/components/CommunityMenu.tsx");
const header = read("src/components/CommunityHeader.tsx");
const sidebar = read("src/components/CommunitySidebar.tsx");
const mockCommunities = read("src/data/mockCommunities.ts");
const rls = read("supabase/migrations/20260704002600_community_public_access_rls.sql");

for (const status of ["owner", "admin", "moderator", "member", "visitor"]) {
  assertIncludes(accessTypes, status, `community access status ${status}`);
  assertIncludes(mockCommunities, `currentUserRole: "${status === "moderator" ? "mod" : status}"`, `mock scenario ${status}`);
}

for (const symbol of ["getCommunityAccess", "canViewChannel", "canSendMessage", "filterCommunityForAccess"]) {
  assertIncludes(permissions, symbol, `permission helper ${symbol}`);
}

for (const component of ["CommunityMenu", "CommunityAdminPanel", "CommunityModeratorPanel", "CommunityMemberMenu", "CommunityVisitorMenu", "JoinCommunityButton", "CommunityJoinModal", "CommunityLeaveModal", "CommunityRoleBadge", "CommunityMenuItem", "PermissionGate"]) {
  assertIncludes(menu, component, `component ${component}`);
}

assertIncludes(header, "openManagementCenter", "header role-aware management integration");
assertIncludes(sidebar, 'setOpenPanel("visitor")', "sidebar visitor panel routing");
assertIncludes(sidebar, "community-readonly-notice", "visitor read-only notice");
assertIncludes(rls, "can_read_public_channel", "RLS public channel helper");
assertIncludes(rls, "community_members_insert_owner_or_public_self_join", "RLS public self join policy");
assertIncludes(rls, "messages_select_visible_channel_or_public", "RLS public message select policy");

console.log("✓ community role access smoke test completed");
