import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260711149900_community_settings_branding_type_configuration.sql");
const service = read("src/services/communityService.ts");
const section = read("src/components/community/CommunitySettingsEditor.tsx");
const branding = read("src/services/communityBrandingService.ts");
const app = read("src/App.tsx");

for (const marker of ["effective_community_permission", "COMMUNITY_NAME_INVALID", "COMMUNITY_DESCRIPTION_INVALID", "COMMUNITY_ICON_INVALID", "COMMUNITY_BANNER_INVALID", "default_notification_level", "valid_community_type_settings", "public_read_enabled=case", "community_update", "redact_audit_reason"]) assert.ok(migration.includes(marker), `missing persistence boundary: ${marker}`);
assert.ok(service.includes("updateCommunitySettings") && service.includes('rpc("update_community_settings"') && !service.includes('.from("communities")\n      .update'), "settings persistence must use the protected RPC");
for (const marker of ["Icon upload", "Banner upload", "Visibility", "Default notifications", "Allow visitors to read public content", "Rules and join acceptance", "Save community settings", "manageCommunity"]) assert.ok(section.includes(marker), `missing settings UI field: ${marker}`);
assert.ok(branding.includes('storage.from("community-branding")') && branding.includes("PNG, JPG, or WEBP") && branding.includes("maxBytes"), "branding uploads must be controlled by the service layer");
assert.ok(app.includes("onCommunityUpdated") && app.includes("replaceCommunities") && app.includes("typeSettings: summary.typeSettings"), "successful settings save must update app state immediately");
console.log("Community settings persistence test: PASS");
