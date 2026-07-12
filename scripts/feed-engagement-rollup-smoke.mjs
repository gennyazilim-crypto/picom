import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260712202000_feed_engagement_rollups.sql","utf8");
const repair = readFileSync("scripts/rebuild-feed-rollups.sql","utf8");
const rls = readFileSync("supabase/tests/rls/feed_engagement_rollups.sql","utf8");

for (const marker of [
  "feed_actor_is_eligible",
  "rebuild_feed_engagement_rollup",
  "sync_message_feed_item",
  "sync_radio_session_feed_item",
  "sync_podcast_episode_feed_item",
  "sync_podcast_comment_feed_item",
  "group by event.actor_id",
  "least(10",
  "least(20",
  "least(3::numeric",
  "external_supporter_count",
  "after insert or update or delete on public.messages",
  "after insert or update or delete on public.attachments",
  "after insert or update or delete on public.message_reactions",
  "after insert or update or delete on public.saved_audio_items",
  "after insert or update of opened_at or delete on public.feed_impressions",
  "reconcile_feed_sources_v1",
  "reconcile_feed_rollups_v1",
]) assert.ok(migration.includes(marker), `missing rollup contract: ${marker}`);

for (const forbidden of ["user_follows","full_body","message_body","continue-on-error"]) assert.ok(!migration.includes(forbidden), `forbidden rollup dependency: ${forbidden}`);
assert.ok(migration.includes("not coalesce(profile.is_bot, false)") && migration.includes("profile.deletion_requested_at is null"),"ineligible actor filters missing");
assert.ok(migration.includes("ban.revoked_at is null"),"community ban exclusion missing");
assert.ok(repair.includes("next_cursor") && repair.includes("500"),"bounded repair instructions missing");
assert.ok(rls.includes("renderer cannot rebuild canonical scores"),"operator-only RLS test missing");
console.log("Feed engagement trigger/rollup structural smoke: PASS");

