import { readFile } from "node:fs/promises";

const migrationPath = "supabase/migrations/20260711153100_meeting_schema_foundation.sql";
const [migration, types, seed, fixtures, docs] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile("src/services/supabase/database.types.ts", "utf8"),
  readFile("supabase/seed.sql", "utf8"),
  readFile("src/data/mockMeetingFixtures.ts", "utf8"),
  readFile("docs/meeting-schema-foundation.md", "utf8"),
]);

const tables = [
  "meeting_rooms", "meeting_sessions", "meeting_session_participants", "meeting_waiting_entries",
  "meeting_invites", "meeting_events", "meeting_attendance",
];
const failures = [];

for (const table of tables) {
  if (!migration.includes(`create table if not exists public.${table}`)) failures.push(`migration missing ${table}`);
  if (!migration.includes(`alter table public.${table} enable row level security`)) failures.push(`RLS not enabled for ${table}`);
  if (!types.includes(`${table}: {`)) failures.push(`generated types missing ${table}`);
}

for (const value of [
  "community_channel", "scheduled_event", "ad_hoc", "voice", "meeting", "stage",
  "join_policy", "max_participants", "linked_chat_channel_id", "idempotency_key",
  "idx_meeting_rooms_community_status", "idx_meeting_sessions_active", "idx_meeting_participants_active",
  "idx_meeting_waiting_room_status", "idx_meeting_invites_expires", "idx_meeting_events_session_time",
  "validate_meeting_room_links", "MEETING_VOICE_CHANNEL_MISMATCH", "MEETING_EVENT_COMMUNITY_MISMATCH",
]) if (!migration.includes(value)) failures.push(`migration missing ${value}`);

if (!migration.includes("revoke all on public.meeting_rooms") || !migration.includes("from anon,authenticated")) failures.push("meeting tables must be fail-closed before Task 532 policies");
if (/\b(bytea|raw_audio_url|raw_video_url|screen_recording_url|recording_url)\b/i.test(migration)) failures.push("migration must not store raw media");
if (!migration.includes("raw_audio") || !migration.includes("livekit_token")) failures.push("metadata forbidden-key guards are missing");
if (!seed.includes("a1000000-0000-4000-8000-000000000001") || !seed.includes("seed-meeting-event-001")) failures.push("local seed parity missing");
if (!fixtures.includes("mockMeetingFixtures")) failures.push("mock fixture parity missing");
if (!docs.includes("Forward-fix") || !docs.includes("Rollback")) failures.push("migration recovery notes missing");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log(`PASS: ${tables.length} meeting metadata tables, indexes, compatibility trigger, fail-closed RLS, generated types, and seed/mock parity are present.`);
