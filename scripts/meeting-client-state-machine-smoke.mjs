import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const types=read("src/types/meetingClient.ts"),store=read("src/stores/meetingStore.ts"),service=read("src/services/meeting/meetingService.ts"),adapter=read("src/services/meeting/meetingLiveKitAdapter.ts"),repository=read("src/services/meeting/meetingRepository.ts"),selectors=read("src/services/meeting/meetingSelectors.ts"),voice=read("src/services/voiceService.ts"),fixtures=read("src/data/mockMeetingClient.ts");
for(const phase of ["idle","prejoin","waiting","token-loading","connecting","connected","reconnecting","disconnected","ended","failed"])assert.ok(types.includes(`| "${phase}"`)||types.includes(`=\n  | "${phase}"`),`missing phase ${phase}`);
for(const marker of ["ALLOWED_TRANSITIONS","generation !== snapshot.generation","participantsById","participantIds","setNoiseShield","setRightDock"])assert.ok(store.includes(marker),`store missing ${marker}`);
for(const marker of ["joinPromise","joinKey","MEETING_STALE_OPERATION","meetingLiveKitAdapter.authorize","meetingRepository.subscribe","meetingSignalService.start","voiceDeviceService.subscribe"])assert.ok(service.includes(marker),`service missing ${marker}`);
assert.ok(adapter.includes("meetingTokenService.fetchToken")&&adapter.includes("voiceService.connectAuthorizedToken")&&adapter.includes("dataSourceService.getStatus().isMock"),"LiveKit adapter must reuse token/voice services and deterministic mock mode");
assert.ok(repository.includes("meetingParticipantReconciliationService")&&repository.includes("meetingWaitingRoomRealtimeService"),"repository must consolidate Supabase meeting authorities");
assert.ok(selectors.includes("participantsById")&&voice.includes("connectAuthorizedToken"),"selectors or provider adapter seam missing");
assert.ok(fixtures.includes("connected")&&fixtures.includes("waiting")&&fixtures.includes("failed"),"deterministic mock fixtures missing");
assert.ok(!service.includes("getSupabaseClient")&&!service.includes("new Room("),"orchestrator must not call provider APIs directly");
console.log("Meeting client store, deterministic transitions, stale-operation guards, repository, LiveKit adapter, and mock fixtures: PASS");
