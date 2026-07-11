import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260710251000_audio_radio_podcast_schema_rls.sql", import.meta.url), "utf8");
const radioMigration = await readFile(new URL("../supabase/migrations/20260711000900_radio_full_mvp_data_model_storage.sql", import.meta.url), "utf8");
for (const table of ["radio_sessions", "radio_listeners", "podcast_episodes", "podcast_episode_reactions", "podcast_episode_comments", "saved_audio_items"]) {
  if (!migration.includes(`create table if not exists public.${table}`)) throw new Error(`Missing ${table}`);
  if (!migration.includes(`alter table public.${table} enable row level security`)) throw new Error(`RLS not enabled for ${table}`);
}
for (const table of ["radio_program_schedules", "radio_program_hosts", "radio_session_hosts", "radio_program_follows", "radio_session_reactions"]) {
  if (!radioMigration.includes(`create table if not exists public.${table}`)) throw new Error(`Missing ${table}`);
  if (!radioMigration.includes(`alter table public.${table} enable row level security`)) throw new Error(`RLS not enabled for ${table}`);
}
for (const helper of ["can_view_community_audio", "can_manage_community_audio", "can_view_radio_session", "can_manage_radio_session", "can_view_podcast_episode", "can_manage_podcast_episode", "can_save_audio_item"]) {
  if (!migration.includes(`function public.${helper}`)) throw new Error(`Missing ${helper}`);
}
if (!migration.includes("radio_listeners_one_active_session_user_idx")) throw new Error("Active listener uniqueness is missing");
if (!migration.includes("'podcast-audio', 'podcast-audio', false") || !migration.includes("'audio-covers', 'audio-covers', false")) throw new Error("Private audio storage buckets are missing");
if (migration.includes("service_role") || migration.includes("public, true")) throw new Error("Migration includes an unsafe secret/public storage pattern");
if (!radioMigration.includes("'draft','scheduled','live','ended','cancelled'") || !radioMigration.includes("radio listeners private metadata")) throw new Error("Radio status or private listener contract is incomplete");
if (!radioMigration.includes("can_view_radio_cover_object") || !radioMigration.includes("can_manage_radio_cover_object") || radioMigration.includes("radio-recordings")) throw new Error("Radio cover storage or recording scope is unsafe");
console.log("Audio schema, RLS helpers, indexes, and private storage policy smoke passed.");
