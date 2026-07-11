import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MeetingRole } from "../../types/meeting";
import type {
  MeetingClientPresenceStatus,
  MeetingParticipantAuthority,
  MeetingParticipantAuthoritativeTrack,
  MeetingParticipantStateSnapshot,
} from "../../types/meetingParticipantState";
import type { VerificationStatus, VerificationType } from "../../types/verification";
import { dataSourceService } from "../dataSourceService";
import { createRealtimeEventDeduper, mapRealtimeSubscriptionStatus, type RealtimeConnectionStatus } from "../supabase/realtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

type ServiceResult<T> = Readonly<{ ok: true; data: T } | { ok: false; error: Readonly<{ code: string; message: string }> }>;
type Subscriber = Readonly<{ onSnapshot: (snapshot: MeetingParticipantStateSnapshot) => void; onStatus: (status: RealtimeConnectionStatus) => void; onError?: (message: string) => void }>;
const mockSnapshots = new Map<string, MeetingParticipantStateSnapshot>();
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const string = (value: unknown): string => typeof value === "string" ? value : "";
const nullableString = (value: unknown): string | null => typeof value === "string" ? value : null;
const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const boolean = (value: unknown): boolean => value === true;
const fail = <T>(code: string, message: string): ServiceResult<T> => ({ ok: false, error: { code, message } });
const key = (roomId: string, sessionId: string): string => `${roomId}:${sessionId}`;

function mapTrack(value: unknown): MeetingParticipantAuthoritativeTrack | null {
  const row = record(value); if (!row) return null;
  const kind = string(row.kind), source = string(row.source), state = string(row.state), id = string(row.id), providerTrackSid = string(row.providerTrackSid);
  if (!id || !providerTrackSid || !["audio","video"].includes(kind) || !["microphone","camera","screen_share","screen_share_audio","unknown"].includes(source) || !["published","unpublished"].includes(state)) return null;
  return { id, providerTrackSid, kind: kind as "audio"|"video", source: source as MeetingParticipantAuthoritativeTrack["source"], state: state as "published"|"unpublished", publishedAt: string(row.publishedAt), unpublishedAt: nullableString(row.unpublishedAt), lastProviderEventAt: nullableString(row.lastProviderEventAt) };
}

function mapParticipant(value: unknown): MeetingParticipantAuthority | null {
  const row = record(value); if (!row) return null;
  const participantId=string(row.participantId),sessionId=string(row.sessionId),providerIdentity=string(row.providerIdentity),displayName=string(row.displayName),meetingRole=string(row.meetingRole) as MeetingRole,providerPresence=string(row.providerPresence) as MeetingParticipantAuthority["providerPresence"];
  if (!participantId || !sessionId || !providerIdentity || !displayName || !["host","cohost","speaker","participant","viewer","guest"].includes(meetingRole) || !["invited","waiting","joining","connected","reconnecting","left","removed"].includes(providerPresence)) return null;
  const communityRole=record(row.communityRole),verification=record(row.verification),clientPresence=record(row.clientPresence),handState=record(row.handState),attendance=record(row.attendance);
  const status=string(verification?.status) as VerificationStatus,type=string(verification?.type) as VerificationType;
  const safeStatus: VerificationStatus=["none","pending","approved","rejected","revoked"].includes(status)?status:"none";
  const presenceStatus=string(clientPresence?.status) as MeetingClientPresenceStatus;
  return {
    participantId,sessionId,userId:nullableString(row.userId),providerIdentity,displayName,username:nullableString(row.username),avatarUrl:nullableString(row.avatarUrl),meetingRole,
    communityRole:communityRole&&string(communityRole.id)&&string(communityRole.name)?{id:string(communityRole.id),name:string(communityRole.name)}:null,
    verification:{status:safeStatus,...(safeStatus==="approved"&&["verified_user","official_community","picom_staff","verified_bot"].includes(type)?{type,approvedAt:nullableString(verification?.approvedAt)??undefined}:{})},
    clientPresence:{status:["online","idle","dnd","offline","unknown"].includes(presenceStatus)?presenceStatus:"unknown",shared:boolean(clientPresence?.shared)},
    providerPresence,capabilities:record(row.capabilities)??{},connectionGeneration:number(row.connectionGeneration),joinedAt:nullableString(row.joinedAt),leftAt:nullableString(row.leftAt),lastSeenAt:nullableString(row.lastSeenAt),lastProviderEventAt:nullableString(row.lastProviderEventAt),lastProviderEventId:nullableString(row.lastProviderEventId),
    handState:{raised:boolean(handState?.raised),raisedAt:nullableString(handState?.raisedAt),sequence:number(handState?.sequence),serverVersion:number(handState?.serverVersion)},
    attendance:attendance?{joinedAt:string(attendance.joinedAt),leftAt:nullableString(attendance.leftAt),durationSeconds:typeof attendance.durationSeconds==="number"?attendance.durationSeconds:null,reconnectCount:number(attendance.reconnectCount),finalState:string(attendance.finalState) as "left"|"removed"|"disconnected"|"ended"}:null,
    tracks:Array.isArray(row.tracks)?row.tracks.map(mapTrack).filter((track):track is MeetingParticipantAuthoritativeTrack=>Boolean(track)):[],
  };
}

export function mapMeetingParticipantSnapshot(value: unknown): MeetingParticipantStateSnapshot | null {
  const row=record(value); if (!row || number(row.schemaVersion)!==1 || !string(row.roomId) || !string(row.sessionId) || !Array.isArray(row.participants)) return null;
  const participants=row.participants.map(mapParticipant).filter((participant):participant is MeetingParticipantAuthority=>Boolean(participant));
  if (participants.length!==row.participants.length) return null;
  return {schemaVersion:1,roomId:string(row.roomId),sessionId:string(row.sessionId),sessionSequence:number(row.sessionSequence),generatedAt:string(row.generatedAt)||new Date().toISOString(),participants};
}

async function load(roomId:string,sessionId:string):Promise<ServiceResult<MeetingParticipantStateSnapshot>> {
  if (!roomId || !sessionId) return fail("MEETING_PARTICIPANT_CONTEXT_INVALID","Choose a valid meeting session.");
  if (dataSourceService.getStatus().isMock) return {ok:true,data:mockSnapshots.get(key(roomId,sessionId))??{schemaVersion:1,roomId,sessionId,sessionSequence:0,generatedAt:new Date().toISOString(),participants:[]}};
  const client=getSupabaseClient(); if(!client) return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured.");
  const {data,error}=await client.rpc("get_meeting_participant_snapshot",{target_room_id:roomId,target_session_id:sessionId}); const mapped=mapMeetingParticipantSnapshot(data);
  return error||!mapped?fail("MEETING_PARTICIPANT_SNAPSHOT_FAILED","Picom could not reconcile meeting participants."):{ok:true,data:mapped};
}

export const meetingParticipantReconciliationService = {
  load,
  seedMock(snapshot:MeetingParticipantStateSnapshot):void { mockSnapshots.set(key(snapshot.roomId,snapshot.sessionId),snapshot); },
  async setHandRaised(participantId:string,raised:boolean):Promise<ServiceResult<Readonly<Record<string,unknown>>>> {
    if(dataSourceService.getStatus().isMock) return {ok:true,data:{participantId,handRaised:raised,updatedAt:new Date().toISOString()}};
    const client=getSupabaseClient(); if(!client) return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured."); const {data,error}=await client.rpc("update_meeting_hand_signal",{target_participant_id:participantId,target_action:raised?"raise":"lower"});
    return error||!record(data)?fail("MEETING_HAND_STATE_FAILED","Picom could not update the hand state."):{ok:true,data:record(data)??{}};
  },
  async cleanupStale(sessionId:string,staleBefore:string):Promise<ServiceResult<Readonly<Record<string,unknown>>>> {
    if(dataSourceService.getStatus().isMock) return {ok:true,data:{sessionId,affected:0,staleBefore}};
    const client=getSupabaseClient(); if(!client) return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured."); const {data,error}=await client.rpc("cleanup_stale_meeting_participants",{target_session_id:sessionId,target_stale_before:staleBefore});
    return error||!record(data)?fail("MEETING_PARTICIPANT_CLEANUP_FAILED","Picom could not clean stale meeting participants."):{ok:true,data:record(data)??{}};
  },
  subscribe(roomId:string,sessionId:string,subscriber:Subscriber):()=>void {
    if(dataSourceService.getStatus().isMock){subscriber.onStatus("connected");void load(roomId,sessionId).then((result)=>{if(result.ok)subscriber.onSnapshot(result.data)});return()=>undefined;}
    const status=getSupabaseClientStatus(),client=getSupabaseClient(); if(!status.configured||!client){subscriber.onStatus("disconnected");subscriber.onError?.(status.reason??"Meeting participant Realtime is unavailable.");return()=>undefined;}
    let channel:RealtimeChannel|null=null,retryTimer:ReturnType<typeof setTimeout>|null=null,refreshTimer:ReturnType<typeof setTimeout>|null=null,attempt=0,generation=0;let canceled=false;const deduper=createRealtimeEventDeduper(1000);
    const refresh=async(localGeneration:number)=>{const result=await load(roomId,sessionId);if(canceled||localGeneration!==generation)return;if(result.ok)subscriber.onSnapshot(result.data);else subscriber.onError?.(result.error.message)};
    const scheduleRefresh=(payload:{eventType:string;commit_timestamp?:string|null;new?:unknown;old?:unknown},localGeneration:number)=>{const row=record(payload.new)??record(payload.old);const eventId=`${payload.eventType}:${string(row?.id??row?.participant_id)}:${payload.commit_timestamp??string(row?.updated_at)}`;if(!deduper.shouldProcess(eventId))return;if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshTimer=null;void refresh(localGeneration)},50)};
    const connect=()=>{if(canceled)return;const localGeneration=++generation;let connected=false;subscriber.onStatus(attempt?"reconnecting":"connecting");channel=client.channel(`meeting-participants:${sessionId}:${localGeneration}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"meeting_session_participants",filter:`session_id=eq.${sessionId}`},(payload)=>scheduleRefresh(payload,localGeneration))
      .on("postgres_changes",{event:"*",schema:"public",table:"meeting_participant_tracks",filter:`session_id=eq.${sessionId}`},(payload)=>scheduleRefresh(payload,localGeneration))
      .on("postgres_changes",{event:"*",schema:"public",table:"meeting_participant_runtime_state",filter:`session_id=eq.${sessionId}`},(payload)=>scheduleRefresh(payload,localGeneration))
      .subscribe((value)=>{if(canceled||localGeneration!==generation)return;const mapped=mapRealtimeSubscriptionStatus(value,connected);if(!mapped)return;if(mapped==="connected"){connected=true;attempt=0;subscriber.onStatus("connected");void refresh(localGeneration);return}subscriber.onStatus(mapped);if((value==="CHANNEL_ERROR"||value==="TIMED_OUT"||value==="CLOSED")&&!retryTimer){attempt+=1;const stale=channel;channel=null;if(stale)void client.removeChannel(stale);retryTimer=setTimeout(()=>{retryTimer=null;connect()},Math.min(10000,750*2**Math.min(attempt,4)))}})};
    connect();return()=>{canceled=true;generation+=1;if(retryTimer)clearTimeout(retryTimer);if(refreshTimer)clearTimeout(refreshTimer);if(channel)void client.removeChannel(channel);channel=null;deduper.clear()};
  },
};
