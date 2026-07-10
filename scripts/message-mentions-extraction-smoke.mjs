import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710204000_message_mentions_extraction.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls/message_mentions_extraction.sql", "utf8");
const feedMigration = readFileSync("supabase/migrations/20260710199000_mention_feed_production.sql", "utf8");
const sendMutation = readFileSync("src/services/messageSendMutation.ts", "utf8");

for (const marker of [
  "security definer",
  "set search_path = public, pg_temp",
  "messages_sync_mentions",
  "after insert or update of body, deleted_at, community_id",
  "profile.id <> new.author_id",
  "member.community_id = new.community_id",
  "having count(distinct profile.id) = 1",
  "limit 20",
  "on conflict (message_id, mentioned_user_id) do nothing",
  "revoke all on function public.sync_message_mentions_from_body()",
  "alter table public.message_mentions replica identity full",
]) assert.ok(migration.toLowerCase().includes(marker.toLowerCase()), `missing extraction marker: ${marker}`);

assert.ok(migration.includes("new.webhook_id is not null"), "webhook-authored messages must not create user mentions");
assert.ok(migration.includes("delete from public.message_mentions"), "edits and deletes must reconcile old mention rows");
assert.ok(feedMigration.includes("from public.message_mentions mention"), "Mention Feed must consume normalized mention rows");
assert.ok(!sendMutation.includes('.from("message_mentions")'), "renderer message mutation must not forge normalized mentions");

for (const marker of [
  "extracts canonical username",
  "extracts unique quoted display name",
  "edit reconciles stale mention rows",
  "soft delete removes mention rows",
  "RLS hides private mention rows from outsider",
  "normal client cannot forge mention rows",
]) assert.ok(rlsTest.includes(marker), `missing pgTAP coverage: ${marker}`);

console.log("Message mention extraction static smoke: PASS");
