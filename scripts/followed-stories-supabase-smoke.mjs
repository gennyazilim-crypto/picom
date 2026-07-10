import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710200000_followed_stories_production.sql", "utf8");
const service = readFileSync("src/services/storyService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

for (const marker of [
  "voice_story_events",
  "followed_user_stories_view",
  "security_invoker = true",
  "public.can_view_profile",
  "public.can_view_message",
  "public.can_view_channel",
  "public.users_are_blocked",
  "'status'::text",
  "'media'",
  "'mention_highlight'",
  "'voice'",
  "'event'",
  "'community_update'",
  "list_followed_user_stories",
]) assert.ok(migration.includes(marker), `missing stories marker: ${marker}`);

assert.ok(service.includes('client.rpc("list_followed_user_stories"'), "story service must use RLS-backed RPC");
assert.ok(service.includes("mockFollowedUserStories"), "story service must preserve mock fallback");
assert.ok(app.includes("storyService.listPage"), "App must load stories through service");

console.log("Followed Stories Supabase static smoke: PASS");
