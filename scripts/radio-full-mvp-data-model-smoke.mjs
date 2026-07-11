import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260711000900_radio_full_mvp_data_model_storage.sql");
const types = read("src/types/audio.ts");
const databaseTypes = read("src/services/supabase/database.types.ts");
const mock = read("src/data/mockAudio.ts");
const dataSource = read("src/services/audio/audioDataSource.ts");
const communityService = read("src/services/audio/radioCommunityService.ts");
const pgTap = read("supabase/tests/rls/radio_full_mvp_data_model.sql");

for (const table of ["radio_program_schedules","radio_program_hosts","radio_session_hosts","radio_program_follows","radio_session_reactions"]) {
  if (!migration.includes(`create table if not exists public.${table}`)) throw new Error(`Radio Full MVP table missing: ${table}`);
  if (!databaseTypes.includes(`${table}: {`)) throw new Error(`Generated database type missing: ${table}`);
}
for (const marker of ["'draft','scheduled','live','ended','cancelled'","RADIO_PROGRAM_COMMUNITY_MISMATCH","RADIO_HOST_MUST_BE_MEMBER","radio listeners private metadata","sync_radio_listener_count","can_view_radio_cover_object","can_manage_radio_cover_object"]) if (!migration.includes(marker)) throw new Error(`Radio migration missing ${marker}`);
for (const marker of ["RadioProgramSchedule","reactionSummary","programId","listenerChatChannelId","coverStoragePath"]) if (!types.includes(marker)) throw new Error(`Radio domain type missing ${marker}`);
for (const marker of ["mockRadioPrograms","mockRadioProgramSchedules","mockRadioAnnouncements","radio-program-design-desk"]) if (!mock.includes(marker)) throw new Error(`Radio mock parity missing ${marker}`);
for (const marker of ["radio_session_reactions","reactToRadioSession","radioReactions","program_id","listener_chat_channel_id"]) if (!dataSource.includes(marker)) throw new Error(`Radio data source missing ${marker}`);
for (const marker of ["radio_program_schedules","radio_program_hosts","mockRadioPrograms","schedules:"]) if (!communityService.includes(marker)) throw new Error(`Radio community service missing ${marker}`);
for (const scenario of ["Radio rows cannot attach to non-radio communities","non-member cannot read private listener metadata","ended Radio session cannot return to live","No unlicensed automatic Radio recording bucket exists"]) if (!pgTap.includes(scenario)) throw new Error(`Radio pgTAP missing ${scenario}`);
if (!/select\s+plan\(23\)/i.test(pgTap) || !/select\s+\*\s+from\s+finish\(\)/i.test(pgTap) || !/rollback;/i.test(pgTap)) throw new Error("Radio pgTAP shape is incomplete");
if (/create\s+table[^;]*(recording|recorded_asset)|insert\s+into\s+storage\.buckets[^;]*radio-recordings|\brecording_url\s+(text|varchar)/i.test(migration)) throw new Error("Recording assets must remain outside release scope");

console.log("Radio Full MVP data model, RLS, storage, types, service, mock, and pgTAP contract passed.");
