import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710201000_profile_activity_production.sql", "utf8");
const service = readFileSync("src/services/profileActivityService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

for (const marker of [
  "get_profile_activity_v2",
  "get_profile_privacy_projection",
  "public.can_view_message",
  "public.community_members",
  "public.message_reactions",
  "public.attachments",
  "public.user_follows",
  "attachment.scan_status in ('clean', 'skipped_development')",
  "security definer",
]) assert.ok(migration.includes(marker), `missing profile activity marker: ${marker}`);

assert.ok(service.includes('client.rpc("get_profile_activity_v3"'), "profile service must use the online-status-safe protected RPC");
assert.ok(service.includes("getMockProfileForMember"), "profile service must retain mock fallback");
assert.ok(app.includes("profileActivityService.load"), "App must load remote profile through the service");
assert.ok(app.includes("profileActivityService.emptyProductionProfile"), "Supabase loading must not expose mock activity/media");

console.log("Profile Activity Supabase static smoke: PASS");
