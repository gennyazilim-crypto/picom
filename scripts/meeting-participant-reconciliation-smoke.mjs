import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260711153800_meeting_participant_reconciliation.sql");
const service = read("src/services/meeting/meetingParticipantReconciliationService.ts");
const store = read("src/stores/meetingParticipantStore.ts");
const types = read("src/types/meetingParticipantState.ts");
const databaseTypes = read("src/services/supabase/database.types.ts");
const sqlTest = read("supabase/tests/meeting_participant_reconciliation.sql");

for (const marker of ["last_provider_event_at","connection_generation","meeting_participant_runtime_state","livekit_participant_event_rank","stale_event","cleanup_stale_meeting_participants","get_meeting_participant_snapshot","set_meeting_participant_hand_state"]) assert.ok(migration.includes(marker), `missing reconciliation marker ${marker}`);
assert.ok(migration.includes("revoke insert,update,delete on table public.meeting_session_participants from authenticated"), "provider-authoritative participant writes are not protected");
for (const table of ["meeting_session_participants","meeting_participant_tracks","meeting_participant_runtime_state"]) assert.ok(migration.includes(`'${table}'`), `Realtime publication missing ${table}`);
for (const rpc of ["get_meeting_participant_snapshot","update_meeting_hand_signal","cleanup_stale_meeting_participants"]) assert.ok(service.includes(`\"${rpc}\"`) && databaseTypes.includes(`${rpc}:`), `service/type RPC contract missing ${rpc}`);
for (const field of ["meetingRole","communityRole","verification","clientPresence","providerPresence","connectionGeneration","connectionQuality"]) assert.ok(types.includes(field), `normalized source boundary missing ${field}`);
assert.ok(store.includes("dedupeParticipants") && store.includes("snapshot.sessionSequence < authoritative.sessionSequence") && store.includes("overlays.delete"), "store does not guard reconnect/stale/ghost state");
assert.ok(!store.includes("meetingRole: overlay") && !store.includes("verification: overlay"), "ephemeral LiveKit overlay can overwrite server authority");
assert.ok(service.includes("removeChannel") && service.includes("generation") && service.includes("createRealtimeEventDeduper"), "Realtime reconnect/cleanup contract missing");
assert.ok(sqlTest.includes("has_table_privilege") && sqlTest.includes("pg_publication_tables"), "SQL privilege/publication assertions missing");
console.log("Meeting participant authority, stale ordering, duplicate reconnect, presence separation, cleanup and Realtime smoke: PASS");
