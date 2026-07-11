import type { MeetingReactionKind } from "../../types/meeting";
import type { MeetingClientParticipant } from "../../types/meetingClient";
import type { MeetingPreJoinSnapshot } from "../../types/meetingPreJoin";
import { dataSourceService } from "../dataSourceService";
import { screenCaptureService, type ScreenCaptureSource } from "../screenCaptureService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../voiceDeviceService";
import { meetingPreJoinService } from "./meetingPreJoinService";
import { meetingService } from "./meetingService";

export type MeetingControlResult<T = true> = Readonly<{ ok: true; data: T } | { ok: false; error: Readonly<{ code: string; message: string }> }>;
export type MeetingControlDevices = Readonly<{
  microphones: VoiceDeviceSnapshot["inputDevices"];
  cameras: MeetingPreJoinSnapshot["cameras"];
  selectedMicrophoneId: string;
  selectedCameraId: string;
  loading: boolean;
}>;
export type MeetingShareSources = Readonly<{ requestId: string; sources: readonly ScreenCaptureSource[] }>;
export type MeetingSessionControlState = Readonly<{ roomId: string; sessionId: string; action: "lock"|"unlock"|"end"; status: string; locked: boolean; ended: boolean }>;

const ok = <T>(data: T): MeetingControlResult<T> => ({ ok: true, data });
const fail = <T>(code: string, message: string): MeetingControlResult<T> => ({ ok: false, error: { code, message } });
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const localParticipant = (): MeetingClientParticipant | null => { const snapshot=meetingService.store.getSnapshot();return snapshot.participantIds.map((id)=>snapshot.participantsById[id]).find((participant)=>participant?.isLocal)??null; };
const deviceSnapshot = (): MeetingControlDevices => { const voice=voiceDeviceService.getSnapshot(),prejoin=meetingPreJoinService.getSnapshot();return{microphones:voice.inputDevices,cameras:prejoin.cameras,selectedMicrophoneId:voice.selectedInputId,selectedCameraId:prejoin.selectedCameraId,loading:voice.isLoading||prejoin.busy}; };

async function sessionControl(action: "lock"|"unlock"|"end"): Promise<MeetingControlResult<MeetingSessionControlState>> {
  const context=meetingService.store.getSnapshot().context;if(!context)return fail("MEETING_CONTEXT_INVALID","Join a meeting before using room controls.");
  if(dataSourceService.getStatus().isMock)return ok({roomId:context.roomId,sessionId:context.sessionId,action,status:action==="end"?"ended":action==="lock"?"locked":"live",locked:action==="lock",ended:action==="end"});
  const client=getSupabaseClient();if(!client)return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured.");
  const{data,error}=await client.rpc("control_meeting_session",{target_room_id:context.roomId,target_session_id:context.sessionId,control_action:action});const row=record(data);
  if(error||!row)return fail("MEETING_CONTROL_FAILED",error?.message??"Picom could not update the meeting.");
  return ok({roomId:String(row.roomId??context.roomId),sessionId:String(row.sessionId??context.sessionId),action,status:String(row.status??""),locked:row.locked===true,ended:row.ended===true});
}

export const meetingControlService = {
  getDevices: deviceSnapshot,
  subscribeDevices(listener: (devices: MeetingControlDevices) => void): () => void { const emit=()=>listener(deviceSnapshot());const first=voiceDeviceService.subscribe(emit),second=meetingPreJoinService.subscribe(emit);emit();return()=>{first();second();}; },
  async refreshDevices(): Promise<MeetingControlDevices> { await meetingPreJoinService.refreshDevices();return deviceSnapshot(); },
  async selectMicrophone(deviceId:string):Promise<MeetingControlResult>{return await voiceDeviceService.selectInput(deviceId)?ok(true):fail("MEETING_MICROPHONE_UNAVAILABLE","The selected microphone is unavailable.");},
  async selectCamera(deviceId:string):Promise<MeetingControlResult>{const selected=await meetingPreJoinService.selectCamera(deviceId);if(!selected)return fail("MEETING_CAMERA_UNAVAILABLE","The selected camera is unavailable.");const current=meetingService.store.getSnapshot();if(current.localMedia.cameraEnabled&&!await meetingService.setCameraEnabled(true,deviceId))return fail("MEETING_CAMERA_UNAVAILABLE","Picom could not switch the active camera.");return ok(true);},
  async setMuted(muted:boolean):Promise<MeetingControlResult>{return await meetingService.setMuted(muted)?ok(true):fail("MEETING_MICROPHONE_FAILED","Picom could not change microphone state.");},
  async setCameraEnabled(enabled:boolean):Promise<MeetingControlResult>{const deviceId=meetingPreJoinService.getSnapshot().selectedCameraId;return await meetingService.setCameraEnabled(enabled,deviceId)?ok(true):fail("MEETING_CAMERA_FAILED","Picom could not change camera state.");},
  setDeafened(deafened:boolean):MeetingControlResult{return meetingService.setDeafened(deafened)?ok(true):fail("MEETING_AUDIO_FAILED","Picom could not change meeting audio playback.");},
  setNoiseShield(enabled:boolean):MeetingControlResult { meetingPreJoinService.setNoiseShield(enabled);const state=meetingService.store.getSnapshot().noiseShield;return enabled&&state.status!=="applied"?fail("MEETING_NOISE_SHIELD_UNAVAILABLE","Noise Shield is unavailable for this microphone/runtime."):ok(true); },
  async listShareSources():Promise<MeetingControlResult<MeetingShareSources>>{if(dataSourceService.getStatus().isMock)return ok({requestId:"mock-screen-request",sources:[{id:"screen:mock-primary",name:"Primary display",type:"screen",thumbnailDataUrl:null,appIconDataUrl:null}]});const result=await screenCaptureService.listSources();return result.ok?ok({requestId:result.requestId,sources:result.sources}):fail(result.error,result.message);},
  async startScreenShare(requestId:string,sourceId:string):Promise<MeetingControlResult>{let id=sourceId,label="Shared screen";if(!dataSourceService.getStatus().isMock){const selected=await screenCaptureService.selectSource(requestId,sourceId);if(!selected.ok)return fail("MEETING_SCREEN_SHARE_SELECTION_FAILED",selected.message);id=selected.source.id;label=selected.source.name;}return await meetingService.startScreenShare(id,label)?ok(true):fail("MEETING_SCREEN_SHARE_FAILED","Picom could not start screen sharing.");},
  async stopScreenShare():Promise<MeetingControlResult>{return await meetingService.stopScreenShare()?ok(true):fail("MEETING_SCREEN_SHARE_FAILED","Picom could not stop screen sharing.");},
  async sendReaction(kind:MeetingReactionKind):Promise<MeetingControlResult>{const result=await meetingService.sendReaction(kind);return result.ok?ok(true):fail(result.error.code,result.error.message);},
  async toggleHand():Promise<MeetingControlResult>{const participant=localParticipant();if(!participant)return fail("MEETING_PARTICIPANT_MISSING","Your meeting participant is not connected.");const raised=!participant.handRaised;if(dataSourceService.getStatus().isMock){const snapshot=meetingService.store.getSnapshot();meetingService.store.replaceParticipants(snapshot.generation,snapshot.participantIds.map((id)=>snapshot.participantsById[id]).filter(Boolean).map((item)=>item.id===participant.id?{...item,handRaised:raised}:item));meetingService.store.patch(snapshot.generation,{handRaised:raised});return ok(true);}const result=await meetingService.applyHandAction(participant.id,raised?"raise":"lower");return result.ok?ok(true):fail(result.error.code,result.error.message);},
  setRoomLocked: (locked:boolean) => sessionControl(locked?"lock":"unlock"),
  async endForEveryone():Promise<MeetingControlResult<MeetingSessionControlState>>{const result=await sessionControl("end");if(result.ok)await meetingService.leave();return result;},
};
