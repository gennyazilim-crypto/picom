import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260710214000_community_settings_persistence.sql");
const service = read("src/services/communityService.ts");
const section = read("src/components/community/CommunityAdminSections.tsx");
const app = read("src/App.tsx");

for (const marker of ["is_community_owner", "has_community_role_level(target_community_id, 80)", "COMMUNITY_NAME_INVALID", "COMMUNITY_DESCRIPTION_INVALID", "COMMUNITY_ICON_INVALID", "COMMUNITY_VISIBILITY_INVALID", "public_read_enabled = case", "community_update", "redact_audit_reason"]) assert.ok(migration.includes(marker), `missing persistence boundary: ${marker}`);
assert.ok(service.includes("updateCommunitySettings") && service.includes('rpc("update_community_settings"') && !service.includes('.from("communities")\n      .update'), "settings persistence must use the protected RPC");
for (const marker of ["Icon URL placeholder", "Visibility", "Allow visitors to read public channels", "Save changes", "manageCommunity"]) assert.ok(section.includes(marker), `missing settings UI field: ${marker}`);
assert.ok(app.includes("onCommunityUpdated") && app.includes("replaceCommunities"), "successful settings save must update app state immediately");
console.log("Community settings persistence test: PASS");
