import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20260711001600_podcast_full_mvp_data_model_storage.sql");
const base = read("supabase/migrations/20260710251000_audio_radio_podcast_schema_rls.sql");
const template = read("supabase/migrations/20260711000500_podcast_community_default_template.sql");
const types = read("src/types/audio.ts");
const databaseTypes = read("src/services/supabase/database.types.ts");
const dataSource = read("src/services/audio/audioDataSource.ts");
const progress = read("src/services/audio/podcastProgressService.ts");
const rlsTest = read("supabase/tests/rls/podcast_full_mvp.sql");

for (const token of ["podcast_community_settings", "podcast_series", "podcast_episodes", "podcast_episode_reactions", "podcast_episode_comments", "saved_audio_items"]) if (!(`${base}\n${template}`).includes(token)) throw new Error("Podcast foundation missing: " + token);
for (const token of ["podcast_playback_progress", "audio_storage_path", "audio_mime_type", "audio_size_bytes", "is_explicit", "reply_to_comment_id", "enforce_podcast_community_kind", "validate_podcast_episode_write", "can_view_podcast_audio_object", "can_manage_podcast_cover_object", "create or replace function public.can_manage_podcast_episode", "podcast audio writers update authorized episode objects"]) if (!migration.includes(token)) throw new Error("Podcast production migration missing: " + token);
for (const token of ["PodcastPlaybackProgress", "audioStoragePath", "audioMimeType", "audioSizeBytes", "isExplicit"]) if (!types.includes(token)) throw new Error("Podcast domain type missing: " + token);
for (const token of ["podcast_playback_progress", "cover_storage_path", "audio_storage_path", "reply_to_comment_id"]) if (!databaseTypes.includes(token)) throw new Error("Generated database contract missing: " + token);
if (!dataSource.includes('storage.from("podcast-audio").createSignedUrl') || !dataSource.includes("audio_storage_path") || !dataSource.includes("row.tags")) throw new Error("Podcast data source does not resolve private media metadata.");
for (const token of ["podcast_playback_progress", "position_seconds", "onConflict: \"user_id,episode_id\""]) if (!progress.includes(token)) throw new Error("Podcast progress service missing: " + token);
if (!/select\s+plan\(/i.test(rlsTest) || !/rollback\s*;/i.test(rlsTest)) throw new Error("Podcast pgTAP contract is incomplete.");
if (/rss|transcod|transcript/i.test(migration)) throw new Error("Post-MVP Podcast processing entered the data model task.");
console.log("Podcast Full MVP data model, private storage, progress, and RLS contract passed.");
