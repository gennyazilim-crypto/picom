import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync("supabase/migrations/20260710199000_mention_feed_production.sql", "utf8");
const service = readFileSync("src/services/mentionFeedService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const databaseTypes = readFileSync("src/services/supabase/database.types.ts", "utf8");

for (const marker of [
  "create table if not exists public.message_mentions",
  "create view public.mention_feed_view",
  "security_invoker = true",
  "public.can_view_message(message.id)",
  "not public.users_are_blocked",
  "follows_select_participants",
  "security invoker",
  "public.list_mention_feed",
]) assert.ok(migration.includes(marker), `missing migration marker: ${marker}`);

assert.ok(service.includes('client.rpc("list_mention_feed"'), "service must use the permission-filtered RPC");
assert.ok(service.includes("dataSourceService.getStatus().isMock"), "service must retain mock mode");
assert.ok(app.includes("mentionFeedService.listPage"), "App must load Supabase Mention Feed through the service");
assert.ok(databaseTypes.includes("message_mentions"), "database types must include mention rows");
assert.ok(databaseTypes.includes("mention_feed_view"), "database types must include feed view");

console.log("Mention Feed Supabase static smoke: PASS");
