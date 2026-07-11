import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260711002900_unified_content_mentions.sql", "utf8");
const service = readFileSync("src/services/mentions/unifiedContentMentionService.ts", "utf8");
const types = readFileSync("src/types/contentMentions.ts", "utf8");
const fixtures = readFileSync("src/data/mockUnifiedContentMentions.ts", "utf8");
const rls = readFileSync("supabase/tests/rls/unified_content_mentions.sql", "utf8");
const databaseTypes = readFileSync("src/services/supabase/database.types.ts", "utf8");

for (const sourceType of ["text_message", "radio_session", "radio_chat", "podcast_episode", "podcast_comment"]) {
  assert.ok(types.includes(`"${sourceType}"`), `missing TypeScript source kind: ${sourceType}`);
  assert.ok(migration.includes(`'${sourceType}'`), `missing SQL source kind: ${sourceType}`);
  assert.ok(fixtures.includes(`"${sourceType}"`) || sourceType === "text_message", `missing mock fixture: ${sourceType}`);
}

for (const marker of [
  "create table if not exists public.content_mentions",
  "CONTENT_MENTION_SOURCE_MISMATCH",
  "message_mentions_sync_unified",
  "radio_sessions_sync_unified_mentions",
  "podcast_comments_sync_unified_mentions",
  "podcast_episodes_sync_unified_mentions",
  "public.can_view_message(target.source_id)",
  "public.can_view_radio_session(target.source_id)",
  "public.can_view_podcast_episode(target.source_id)",
  "not public.users_are_blocked",
  "force row level security",
  "security invoker",
  "list_unified_content_mentions",
]) assert.ok(migration.includes(marker), `missing migration contract: ${marker}`);

assert.ok(service.includes('client.rpc("list_unified_content_mentions"'), "service must use the protected RPC");
assert.ok(service.includes("dataSourceService.getStatus().isMock"), "service must preserve mock mode");
assert.ok(types.includes("getUnifiedMentionNavigation"), "source-aware navigation adapter missing");
assert.ok(databaseTypes.includes("content_mentions"), "generated database contract must include content mentions");
assert.ok(databaseTypes.includes("list_unified_content_mentions"), "generated database contract must include unified RPC");
assert.ok(rls.includes("normal client cannot forge unified mentions"), "RLS write-denial test missing");
assert.ok(rls.includes("private podcast sources use episode access"), "private podcast access test missing");

console.log("Unified text/radio/podcast mention model smoke: PASS");
