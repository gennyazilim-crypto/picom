import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const expectIncludes = (source, marker, label) => {
  if (!source.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};

const source = read("src/services/audio/audioDataSource.ts");
const radioRealtime = read("src/services/audio/radioRealtimeService.ts");
const podcastRealtime = read("src/services/audio/podcastRealtimeService.ts");
const hook = read("src/hooks/useAudioCatalog.ts");
const publishing = read("src/services/audio/podcastPublishingService.ts");
const progress = read("src/services/audio/podcastProgressService.ts");
const radioCover = read("src/services/audio/radioCoverService.ts");
const radioMigration = read("supabase/migrations/20260711001000_radio_services_realtime.sql");
const podcastMigration = read("supabase/migrations/20260711001700_podcast_interactions_listener_state.sql");
const audioSchema = read("supabase/migrations/20260710251000_audio_radio_podcast_schema_rls.sql");
const radioStorage = read("supabase/migrations/20260711000900_radio_full_mvp_data_model_storage.sql");
const podcastStorage = read("supabase/migrations/20260711001600_podcast_full_mvp_data_model_storage.sql");
const integrationMigration = read("supabase/migrations/20260711151100_audio_production_integration.sql");
const rlsTest = read("supabase/tests/rls/audio_production_integration.sql");

for (const marker of [
  "dataSourceService.getStatus().isMock",
  "loadSupabaseCatalog",
  "transition_radio_session",
  "join_current_user_radio_listener",
  "heartbeat_current_user_radio_listener",
  "radio_session_reactions",
  "saved_audio_items",
  "podcast_episodes",
  "podcast_episode_reactions",
  "podcast_episode_comments",
]) expectIncludes(source, marker, "Audio data-source production contract");

for (const marker of ["podcast-audio", "audio-covers", "createSignedUrl", "updatePodcastMedia"]) {
  expectIncludes(publishing, marker, "Podcast private publishing contract");
}
expectIncludes(progress, "podcast_playback_progress", "Podcast progress persistence");
expectIncludes(radioCover, 'storage.from("audio-covers")', "Radio cover Storage contract");

for (const [realtime, tables, label] of [
  [radioRealtime, ["radio_sessions", "radio_listeners", "radio_session_reactions", "radio_program_schedules", "radio_program_hosts", "radio_session_hosts"], "Radio"],
  [podcastRealtime, ["podcast_episodes", "podcast_episode_reactions", "podcast_episode_comments", "saved_audio_items", "podcast_playback_progress"], "Podcast"],
]) {
  for (const table of tables) expectIncludes(realtime, table, `${label} Realtime table contract`);
  expectIncludes(realtime, "client.removeChannel", `${label} Realtime cleanup`);
  expectIncludes(realtime, "createRealtimeEventDeduper", `${label} Realtime deduplication`);
}
expectIncludes(hook, "radioRealtimeService.subscribe", "Radio Realtime lifecycle integration");
expectIncludes(hook, "podcastRealtimeService.subscribe", "Podcast Realtime lifecycle integration");
expectIncludes(hook, "audioDataSource.refresh", "Realtime catalog reconciliation");

for (const marker of ["audio-covers", "can_view_radio_cover_object"]) {
  expectIncludes(radioStorage, marker, "Radio kind/Storage RLS contract");
}
for (const marker of ["enforce_radio_community_kind", "radio_session_kind_guard", "RADIO_COMMUNITY_KIND_REQUIRED"]) {
  expectIncludes(integrationMigration, marker, "Radio table-level kind contract");
}
for (const marker of ["enforce_podcast_community_kind", "podcast-audio", "users read own visible podcast progress"]) {
  expectIncludes(podcastStorage, marker, "Podcast kind/private RLS contract");
}
expectIncludes(audioSchema, "podcast episodes visible according to publication and community access", "Podcast draft visibility policy");
expectIncludes(radioMigration, "alter publication supabase_realtime", "Radio Realtime publication migration");
expectIncludes(podcastMigration, "alter publication supabase_realtime", "Podcast Realtime publication migration");
expectIncludes(rlsTest, "Radio and Podcast tables preserve type-specific community guards", "Integrated pgTAP type guard");
expectIncludes(rlsTest, "Podcast drafts and private media remain RLS-protected", "Integrated pgTAP private media guard");
expectIncludes(rlsTest, "Radio and Podcast Realtime publications cover production tables", "Integrated pgTAP Realtime guard");

for (const entry of readdirSync("src/components/audio", { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
  const component = read(join("src/components/audio", entry.name));
  if (/getSupabaseClient|\.from\(|\.rpc\(|\.storage\./.test(component)) {
    throw new Error(`Audio UI bypasses the service layer: ${entry.name}`);
  }
}

console.log("Supabase Radio/Podcast production integration contract passed.");
