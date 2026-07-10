import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260710211000_community_invite_acceptance_production.sql");
const service = read("src/services/community/communityInviteService.ts");
const modal = read("src/components/CommunityInviteModals.tsx");
const app = read("src/App.tsx");

for (const marker of ["INVITE_INVALID", "INVITE_REVOKED", "INVITE_EXPIRED", "INVITE_BANNED", "INVITE_EXHAUSTED", "DEFAULT_ROLE_MISSING", "for update", "is_default = true", "on conflict (community_id, user_id) do nothing", "invite_accept", "redact_audit_reason", "already_member"]) assert.ok(migration.includes(marker), `missing invite acceptance boundary: ${marker}`);
assert.ok(migration.indexOf("INVITE_BANNED") < migration.indexOf("already_member'::text"), "active bans must win over existing-member responses");
assert.ok(service.includes('client.rpc("accept_community_invite_v2"') && service.includes("mapInviteAcceptanceError") && service.includes("InviteAcceptanceStatus"), "service must use typed v2 results and safe error mapping");
assert.ok(!service.includes('error?.message.includes("banned")') && !service.includes("message: error?.message"), "raw backend errors must not reach invite UI");
assert.ok(modal.includes("result.data.status") && app.includes('status === "already_member"'), "UI must distinguish safe idempotent membership responses");
console.log("Community invite acceptance production test: PASS");
