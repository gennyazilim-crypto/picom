import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260710212000_join_public_community_production.sql");
const service = read("src/services/community/communityMembershipService.ts");
const menu = read("src/components/CommunityMenu.tsx");
const permissions = read("src/services/permissions/communityPermissions.ts");
const app = read("src/App.tsx");

for (const marker of ["AUTH_REQUIRED", "COMMUNITY_NOT_FOUND", "PRIVATE_COMMUNITY_INVITE_REQUIRED", "JOIN_BANNED", "DEFAULT_ROLE_MISSING", "already_member", "is_default = true", "on conflict (community_id, user_id) do nothing", "member_change", "redact_audit_reason"]) assert.ok(migration.includes(marker), `missing public join boundary: ${marker}`);
assert.ok(service.includes('rpc("join_public_community"') && !service.includes('.from("community_members")\n      .insert'), "public joins must use the atomic RPC instead of renderer-side inserts");
assert.ok(service.includes("CommunityJoinStatus") && service.includes("mapPublicJoinError"), "service must expose typed statuses and safe errors");
assert.ok(menu.includes("Invite required") && menu.includes("inviteRequired"), "private community modal must route to invite/approval");
assert.ok(permissions.includes('if (access.isVisitor) return false') && permissions.includes('Join this community to send messages.'), "visitor composer must stay permission-disabled");
assert.ok(app.includes("result.data.member") && app.includes('result.data.status === "already_member"'), "joined membership must update app state idempotently");
console.log("Public community join production test: PASS");
