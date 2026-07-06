import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/database-integrity.md");
const baseline = read("supabase/migrations/20260704000100_baseline.sql");
const members = read("supabase/migrations/20260704000400_community_members_schema.sql");
const channels = read("supabase/migrations/20260704000700_channels_schema.sql");
const messages = read("supabase/migrations/20260704000800_messages_schema.sql");
const readStates = read("supabase/migrations/20260704001100_read_states_schema.sql");
const sequences = read("supabase/migrations/20260704002500_message_sequence_numbers.sql");

for (const expected of [
  "Database Integrity Constraints Audit",
  "Users and profiles",
  "Communities and owners",
  "Community members",
  "Roles",
  "Channels",
  "Messages",
  "Attachments",
  "Reactions",
  "Read states",
  "Placeholder and future tables",
  "Deletion behavior policy notes",
  "Current gaps",
]) {
  assertIncludes(doc, expected, "database integrity docs");
}

for (const expected of [
  "references auth.users(id) on delete cascade",
  "owner_id uuid not null references public.profiles(id) on delete restrict",
  "unique (community_id, user_id)",
  "unique (message_id, user_id, emoji)",
  "last_read_message_id uuid references public.messages(id) on delete set null",
]) {
  assertIncludes(baseline, expected, "baseline integrity migration");
}

for (const expected of [
  "ensure_member_role_matches_community",
  "role_id must belong to the same community",
]) {
  assertIncludes(members, expected, "member integrity migration");
}

for (const expected of [
  "ensure_channel_category_matches_community",
  "category_id must belong to the same community",
]) {
  assertIncludes(channels, expected, "channel integrity migration");
}

for (const expected of [
  "messages_author_client_message_unique",
  "ensure_message_channel_matches_community",
  "channel_id must belong to the same community",
]) {
  assertIncludes(messages, expected, "message integrity migration");
}

for (const expected of [
  "ensure_read_state_message_matches_channel",
  "last_read_message_id must belong to the same channel",
]) {
  assertIncludes(readStates, expected, "read state integrity migration");
}

for (const expected of [
  "messages_channel_sequence_unique",
  "assign_message_sequence",
  "pg_advisory_xact_lock",
]) {
  assertIncludes(sequences, expected, "message sequence migration");
}

console.log("Database integrity constraints audit smoke test passed.");

