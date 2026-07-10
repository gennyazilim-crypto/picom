import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("supabase/migrations/20260710248000_direct_messages_schema_rls_foundation.sql");
const tests = read("supabase/tests/rls/direct_messages.sql");
const types = read("src/services/supabase/database.types.ts");
const service = read("src/services/supabase/directMessageService.ts");
const mentionFeed = read("src/services/mentionFeedService.ts");
const search = read("src/services/advancedSearchService.ts");
const docs = read("docs/direct-messages-schema-rls.md");

const assertions = [
  [migration, "alter table public.direct_conversation_members rename to direct_conversation_participants", "canonical participant table migration"],
  [migration, "last_message_at timestamptz", "conversation last-message timestamp"],
  [migration, "muted_until timestamptz", "participant mute state"],
  [migration, "archived_at timestamptz", "participant archive state"],
  [migration, "blocked_at timestamptz", "participant blocked state"],
  [migration, "reply_to_message_id uuid", "message reply relation"],
  [migration, "create index if not exists idx_direct_messages_conversation_created_at", "message pagination index"],
  [migration, "alter table public.direct_conversations enable row level security", "conversation RLS"],
  [migration, "direct_conversations_select_participants", "participant-only conversation policy"],
  [migration, "direct_messages_insert_participant_author", "participant-only message insert policy"],
  [migration, "direct_messages_update_own", "own-message update policy"],
  [migration, "direct_messages_delete_own", "own-message delete policy"],
  [migration, "direct_attachments_select_participants", "participant-only attachment policy"],
  [migration, "direct_reactions_delete_own", "own-reaction delete policy"],
  [migration, "blocked_at is null", "blocked participant send guard"],
  [migration, "public.direct_message_attachments, public.direct_message_reactions from anon", "anonymous access revoked"],
  [tests, "non-member cannot read direct conversation metadata", "conversation metadata isolation test"],
  [tests, "non-member cannot read direct attachments", "attachment isolation test"],
  [tests, "blocked participant cannot send direct messages", "blocked send test"],
  [types, "direct_conversation_participants", "database types use canonical table"],
  [types, "reply_to_message_id", "database types expose reply relation"],
  [service, "row.body ?? \"\"", "nullable message body compatibility"],
  [docs, "Mention Feed", "privacy boundary documented"],
];

for (const [source, marker, label] of assertions) {
  if (!source.includes(marker)) throw new Error(`Direct Messages schema/RLS smoke failed: missing ${label} (${marker})`);
}

if (/direct_messages|direct_conversations|direct_message_attachments/.test(mentionFeed)) {
  throw new Error("Mention Feed must not query private Direct Messages tables.");
}
if (/direct_messages|direct_conversations|direct_message_attachments/.test(search)) {
  throw new Error("Global search must not query private Direct Messages tables.");
}

console.log("Direct Messages schema/RLS structural smoke passed.");
