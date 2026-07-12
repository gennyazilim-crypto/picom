import { meetingStore } from "../../stores/meetingStore";
import type { MeetingParticipantAuthority, MeetingParticipantStateSnapshot } from "../../types/meetingParticipantState";
import type { MeetingClientError, MeetingClientJoinRequest, MeetingClientParticipant, MeetingClientResult, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingCapabilities, MeetingRole } from "../../types/meeting";
import { voiceDeviceService } from "../voiceDeviceService";
import { meetingSignalService } from "./meetingSignalService";
import { meetingWaitingRoomService } from "./meetingWaitingRoomService";
import { getMeetingCapabilities } from "./meetingCapabilityService";
import { meetingLiveKitAdapter } from "./meetingLiveKitAdapter";
import { meetingRepository } from "./meetingRepository";
import { noiseShieldService } from "../noiseShieldService";
import type { NoiseShieldMode, NoiseShieldSnapshot } from "../../types/noiseShield";
import type { MeetingCameraQualityPreset } from "../../types/meetingVideoGrid";
import { meetingScreenShareLeaseService } from "./meetingScreenShareLeaseService";
import { meetingDeviceRecoveryService } from "./meetingDeviceRecoveryService";

let currentRequest: MeetingClientJoinRequest | null = null;
let joinPromise: Promise<MeetingClientResult<MeetingClientSnapshot>> | null = null;
let joinKey: string | null = null;
let authorizationRefreshPromise: Promise<MeetingClientResult<MeetingClientSnapshot>> | null = null;
let reconnectPromise: Promise<void> | null = null;
let reconnectSequence = 0;
let reconnectWaitCleanup: (() => void) | null = null;
let sessionCleanups: Array<() => void> = [];
const meetingReconnectBackoffMs = [500, 1_500, 3_500] as const;

const keyOf = (request: MeetingClientJoinRequest) => `${request.roomId}:${request.sessionId}`;
const fail = (code: MeetingClientError["code"], message: string, recoverable = true, providerCode?: string): MeetingClientError => ({ code, message, recoverable, providerCode });
const stale = (): MeetingClientResult<MeetingClientSnapshot> => ({ ok: false, error: fail("MEETING_STALE_OPERATION", "A newer meeting action replaced this request.", true) });

function stopBindings(): void {
  for (const cleanup of sessionCleanups.splice(0)) {
    try { cleanup(); } catch { /* Continue draining independent session resources. */ }
  }
  try { meetingSignalService.stop(); } catch { /* A failed signal cleanup must not retain media resources. */ }
}

function cancelMeetingReconnect(): void {
  reconnectSequence += 1;
  reconnectWaitCleanup?.();
  reconnectWaitCleanup = null;
}

function waitForReconnectWindow(delayMs: number, sequence: number): Promise<boolean> {
  return new Promise((resolve) => {
    let delayElapsed = delayMs === 0;
    let online = typeof navigator === "undefined" || navigator.onLine;
    let settled = false;
    const timers: number[] = [];
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("online", onOnline);
      if (reconnectWaitCleanup === cancel) reconnectWaitCleanup = null;
      resolve(ready && sequence === reconnectSequence);
    };
    const maybeFinish = () => { if (delayElapsed && online) finish(true); };
    const onOnline = () => { online = true; maybeFinish(); };
    const cancel = () => finish(false);
    reconnectWaitCleanup = cancel;
    window.addEventListener("online", onOnline);
    timers.push(window.setTimeout(() => {
      delayElapsed = true;
      online = typeof navigator === "undefined" || navigator.onLine;
      maybeFinish();
    }, delayMs));
    timers.push(window.setTimeout(() => finish(false), delayMs + 8_000));
    maybeFinish();
  });
}

function terminalDisconnect(errorCode: string | null): "ended" | "revoked" | null {
  if (errorCode === "VOICE_ROOM_ENDED") return "ended";
  if (errorCode === "VOICE_ACCESS_REVOKED" || errorCode === "VOICE_SESSION_REPLACED") return "revoked";
  return null;
}

function capabilities(role: MeetingRole, token?: Readonly<{ canPublishAudio:boolean;canPublishVideo:boolean;canPublishScreen:boolean;canPublishData:boolean }>): MeetingCapabilities {
  const base = getMeetingCapabilities(role);
  return token ? { ...base, canPublishAudio: base.canPublishAudio&&token.canPublishAudio, canPublishVideo: base.canPublishVideo&&token.canPublishVideo, canShareScreen: base.canShareScreen&&token.canPublishScreen, canReact: base.canReact } : base;
}

function authoritativeParticipant(item: MeetingParticipantAuthority): MeetingClientParticipant {
  return {
    id: item.participantId,
    userId: item.userId ?? undefined,
    identity: item.providerIdentity,
    displayName: item.displayName,
    username: item.username ?? undefined,
    avatarUrl: item.avatarUrl ?? undefined,
    role: item.meetingRole,
    communityRole: item.communityRole,
    verification: item.verification,
    presence: item.providerPresence,
    isLocal: false,
    isSpeaking: false,
    microphoneEnabled: item.tracks.some((track) => track.source === "microphone" && track.state === "published"),
    cameraEnabled: item.tracks.some((track) => track.source === "camera" && track.state === "published"),
    screenSharing: item.tracks.some((track) => track.source === "screen_share" && track.state === "published"),
    screenShareAllowed: item.capabilities.canShareScreen !== false,
    handRaised: item.handState.raised,
    connectionQuality: "unknown",
  };
}

function applyAuthoritativeParticipants(generation: number, snapshot: MeetingParticipantStateSnapshot): void {
  const current = meetingStore.getSnapshot();
  if (current.generation !== generation) return;
  const priorByIdentity = new Map(
    current.participantIds
      .map((id) => current.participantsById[id])
      .filter(Boolean)
      .map((participant) => [participant.identity, participant]),
  );
  const previousLocal = [...priorByIdentity.values()].find((participant) => participant.isLocal);
  const participants = snapshot.participants.map((item) => {
    const authoritative = authoritativeParticipant(item);
    const prior = priorByIdentity.get(authoritative.identity);
    return {
      ...authoritative,
      isLocal: prior?.isLocal ?? false,
      isSpeaking: prior?.isSpeaking ?? false,
      cameraStream: prior?.cameraStream,
      connectionQuality: prior?.connectionQuality ?? authoritative.connectionQuality,
    };
  });
  const nextLocal = participants.find((participant) => participant.identity === previousLocal?.identity);
  meetingStore.replaceParticipants(generation, participants);
  if (!previousLocal || !nextLocal) return;
  const roleChanged = previousLocal.role !== nextLocal.role;
  const screenPolicyChanged = previousLocal.screenShareAllowed !== nextLocal.screenShareAllowed;
  if (!roleChanged && !screenPolicyChanged) return;

  const baseCapabilities = capabilities(nextLocal.role);
  const nextCapabilities = nextLocal.screenShareAllowed === false ? { ...baseCapabilities, canShareScreen: false } : baseCapabilities;
  meetingStore.setCapabilities(generation, nextLocal.role, nextCapabilities);
  if (!nextCapabilities.canPublishAudio && !meetingStore.getSnapshot().localMedia.muted) {
    queueMicrotask(() => { void meetingService.setMuted(true); });
  }
  if (!nextCapabilities.canShareScreen && meetingStore.getSnapshot().localMedia.screenSharing) queueMicrotask(() => { void meetingService.stopScreenShare(); });
  queueMicrotask(() => { void meetingService.refreshAuthorization(); });
}

function applyProviderParticipants(generation:number,snapshot:ReturnType<typeof meetingLiveKitAdapter.getSnapshot>):void {
  const current=meetingStore.getSnapshot(); if(current.generation!==generation)return;
  const priorByIdentity=new Map(current.participantIds.map((id)=>current.participantsById[id]).filter(Boolean).map((participant)=>[participant.identity,participant]));
  const participants=snapshot.participants.map((item)=>{
    const prior=priorByIdentity.get(item.identity);
    const cameraTrack=(snapshot.cameraTracks??[]).find((track)=>track.participantIdentity===item.identity);
    return {id:prior?.id??`provider:${item.identity}`,userId:prior?.userId,identity:item.identity,displayName:item.name,username:prior?.username,avatarUrl:prior?.avatarUrl,role:prior?.role??current.role??"participant",communityRole:prior?.communityRole,verification:prior?.verification,presence:snapshot.status==="reconnecting"?"reconnecting" as const:"connected" as const,isLocal:item.isLocal,isSpeaking:item.isSpeaking,microphoneEnabled:item.isMicrophoneEnabled,cameraEnabled:item.isCameraEnabled||Boolean(cameraTrack),cameraStream:cameraTrack?.stream,screenSharing:snapshot.screenShares.some((share)=>share.participantIdentity===item.identity),screenShareAllowed:prior?.screenShareAllowed??true,handRaised:prior?.handRaised??false,connectionQuality:item.connectionQuality};
  });
  meetingStore.replaceParticipants(generation,participants);
}

function scheduleMeetingReconnect(generation:number,request:MeetingClientJoinRequest):void {
  if(reconnectPromise)return;
  const sequence=++reconnectSequence;
  const operation=(async()=>{
    let lastError:MeetingClientError|null=null;
    for(let attempt=0;attempt<meetingReconnectBackoffMs.length;attempt+=1){
      if(sequence!==reconnectSequence||meetingStore.getSnapshot().generation!==generation||currentRequest!==request)return;
      meetingStore.transition(generation,"reconnecting",{providerStatus:`reconnecting_${attempt+1}_of_${meetingReconnectBackoffMs.length}`,error:lastError});
      const ready=await waitForReconnectWindow(meetingReconnectBackoffMs[attempt],sequence);
      if(!ready){
        if(sequence!==reconnectSequence)return;
        lastError=fail("MEETING_RECONNECT_FAILED","Picom is offline. Reconnect will resume when the network is available.",true,"offline");
        continue;
      }
      const result=await joinSerialized(request,true);
      if(result.ok)return;
      lastError=result.error;
      if(!result.error.recoverable)return;
    }
    if(sequence===reconnectSequence&&meetingStore.getSnapshot().generation===generation&&currentRequest===request){
      const message=lastError?.providerCode==="offline"
        ? "Picom could not reconnect because this device is offline. Check the network and try again."
        : "Picom could not reconnect after several attempts. The meeting may be unavailable; try again when the connection is stable.";
      meetingStore.setError(generation,fail("MEETING_RECONNECT_FAILED",message,true,lastError?.providerCode??"retry_exhausted"));
    }
  })();
  reconnectPromise=operation;
  void operation.finally(()=>{if(reconnectPromise===operation)reconnectPromise=null;});
}

const clientNoiseShield=(state:NoiseShieldSnapshot):MeetingClientSnapshot["noiseShield"]=>({requested:state.requestedMode!=="off",applied:state.appliedMode!=="off"&&(state.status==="applied"||state.status==="fallback"),requestedMode:state.requestedMode,appliedMode:state.appliedMode,availableModes:state.availableModes,provider:state.provider,status:state.status,fallbackReason:state.fallbackReason});

function bindSession(generation:number,request:MeetingClientJoinRequest):void {
  stopBindings();
  sessionCleanups.push(noiseShieldService.subscribe(()=>meetingStore.patch(generation,{noiseShield:clientNoiseShield(noiseShieldService.getSnapshot())})));
  sessionCleanups.push(meetingLiveKitAdapter.subscribe((provider)=>{
    if(meetingStore.getSnapshot().generation!==generation)return;
    const wasSharing=meetingStore.getSnapshot().localMedia.screenSharing;
    if(provider.status==="disconnected"){
      if(wasSharing)void meetingScreenShareLeaseService.release(request.roomId,request.sessionId);
      meetingStore.patch(generation,{screenShares:provider.screenShares,localMedia:{muted:provider.muted,deafened:provider.deafened,cameraEnabled:false,screenSharing:false}});
      applyProviderParticipants(generation,provider);
      const terminal=terminalDisconnect(provider.errorCode);
      if(terminal==="ended"){
        cancelMeetingReconnect();
        meetingStore.transition(generation,"ended",{providerStatus:provider.errorCode??"room_ended",error:fail("MEETING_ENDED",provider.error??"The host ended this meeting.",false,provider.errorCode??"room_ended")});
      }else if(terminal==="revoked"){
        cancelMeetingReconnect();
        meetingStore.setError(generation,fail("MEETING_PERMISSION_DENIED",provider.error??"Meeting access was revoked.",false,provider.errorCode??"access_revoked"));
      }else{
        meetingStore.transition(generation,"reconnecting",{providerStatus:provider.errorCode??"connection_interrupted",error:fail("MEETING_RECONNECT_FAILED",provider.error??"The meeting connection was interrupted. Picom is requesting fresh authorization.",true,provider.errorCode??"connection_interrupted")});
        scheduleMeetingReconnect(generation,request);
      }
      return;
    }
    const phase=provider.status==="connected"?"connected":provider.status==="reconnecting"?"reconnecting":provider.status==="connecting"?"connecting":provider.status==="requesting_token"?"token-loading":null;
    if(phase){meetingStore.transition(generation,phase,{providerStatus:provider.status,localMedia:{muted:provider.muted,deafened:provider.deafened,cameraEnabled:Boolean(provider.cameraEnabled),screenSharing:provider.screenSharing},error:null});if(wasSharing&&!provider.screenSharing)void meetingScreenShareLeaseService.release(request.roomId,request.sessionId);}
    else if(provider.errorCode)meetingStore.setError(generation,fail(provider.errorCode==="VOICE_PERMISSION_DENIED"?"MEETING_PERMISSION_DENIED":"MEETING_PROVIDER_ERROR",provider.error??"The meeting provider reported an error.",true,provider.errorCode));
    meetingStore.patch(generation,{screenShares:provider.screenShares});
    applyProviderParticipants(generation,provider);
  }));
  sessionCleanups.push(meetingRepository.subscribe(request.roomId,request.sessionId,{
    onParticipants:(snapshot:MeetingParticipantStateSnapshot)=>applyAuthoritativeParticipants(generation,snapshot),
    onWaitingEntry:(entry)=>{if(meetingStore.getSnapshot().generation!==generation)return;if(entry.userId!==meetingStore.getSnapshot().participantsById[meetingStore.getSnapshot().participantIds.find((id)=>meetingStore.getSnapshot().participantsById[id]?.isLocal)??""]?.userId&&meetingStore.getSnapshot().waitingEntry?.id!==entry.id)return;meetingStore.patch(generation,{waitingEntry:{id:entry.id,status:entry.status}});if(entry.status==="admitted"&&currentRequest)void meetingService.join(currentRequest,true);if(entry.status==="denied")meetingStore.setError(generation,fail("MEETING_ADMISSION_DENIED",entry.decisionNote||"The host denied this meeting request.",false,"host_denied"));if(entry.status==="expired")meetingStore.setError(generation,fail("MEETING_ADMISSION_DENIED","This waiting-room request expired before admission.",true,"expired"));},
    onRealtimeStatus:(realtimeStatus)=>meetingStore.patch(generation,{realtimeStatus}),
    onError:(message)=>meetingStore.patch(generation,{error:fail("MEETING_PROVIDER_ERROR",message,true)}),
  }));
  sessionCleanups.push(meetingSignalService.start({roomId:request.roomId,sessionId:request.sessionId}));
  sessionCleanups.push(meetingSignalService.subscribeReactions((reaction)=>meetingStore.appendReaction(generation,{id:reaction.eventId,senderIdentity:reaction.senderIdentity,kind:reaction.kind,createdAt:reaction.sentAt,expiresAt:reaction.expiresAt})));
  sessionCleanups.push(meetingSignalService.subscribeHandQueue(request.roomId,request.sessionId,{onSnapshot:(queue)=>{const current=meetingStore.getSnapshot();const participants=current.participantIds.map((id)=>current.participantsById[id]).filter(Boolean);const handByParticipant=new Map(queue.entries.map((entry)=>[entry.participantId,entry.handRaised]));const next=participants.map((participant)=>handByParticipant.has(participant.id)?{...participant,handRaised:handByParticipant.get(participant.id)??false}:participant);const local=next.find((participant)=>participant.isLocal);meetingStore.replaceParticipants(generation,next);meetingStore.patch(generation,{handRaised:local?.handRaised??false,stageQueue:queue.entries});},onStatus:(realtimeStatus)=>meetingStore.patch(generation,{realtimeStatus}),onError:(message)=>meetingStore.patch(generation,{error:fail("MEETING_PROVIDER_ERROR",message,true)})}));
  sessionCleanups.push(voiceDeviceService.subscribe((devices)=>meetingStore.patch(generation,{localDevices:{inputId:devices.selectedInputId,outputId:devices.selectedOutputId,permission:devices.permission}})));
  sessionCleanups.push(meetingDeviceRecoveryService.start((notice)=>meetingStore.patch(generation,{deviceNotice:notice.message})));
}

async function prepare(request:MeetingClientJoinRequest):Promise<number> {
  cancelMeetingReconnect(); stopBindings(); await meetingLiveKitAdapter.disconnect(); currentRequest=request;
  const generation=meetingStore.begin({roomId:request.roomId,sessionId:request.sessionId,communityId:request.communityId,communityName:request.communityName,channelId:request.channelId,channelName:request.channelName,roomTitle:request.roomTitle,roomMode:request.roomMode});
  const shield=noiseShieldService.activateMeeting(request.roomId,request.noiseShieldMode??(request.noiseShield?"standard":"off"));meetingStore.patch(generation,{noiseShield:clientNoiseShield(shield)});
  if(request.roomMode==="stage")meetingStore.setLayout("stage");
  const devices=voiceDeviceService.getSnapshot();meetingStore.patch(generation,{localDevices:{inputId:devices.selectedInputId,outputId:devices.selectedOutputId,permission:devices.permission}});return generation;
}

async function performJoin(request:MeetingClientJoinRequest,force:boolean):Promise<MeetingClientResult<MeetingClientSnapshot>> {
  let generation=meetingStore.getSnapshot().generation;
  if(meetingStore.getSnapshot().context?.roomId!==request.roomId||meetingStore.getSnapshot().context?.sessionId!==request.sessionId||meetingStore.getSnapshot().phase==="idle"||meetingStore.getSnapshot().phase==="ended")generation=await prepare(request);
  if(!force&&meetingStore.getSnapshot().phase==="connected")return{ok:true,data:meetingStore.getSnapshot()};
  if(!meetingStore.transition(generation,"token-loading",{error:null,providerStatus:"requesting_token"}))return stale();
  const tokenResult=await meetingLiveKitAdapter.authorize(request);if(meetingStore.getSnapshot().generation!==generation)return stale();
  if(!tokenResult.ok){const error=fail("MEETING_TOKEN_UNAVAILABLE",tokenResult.error.message,true,tokenResult.error.code);meetingStore.setError(generation,error);return{ok:false,error};}
  const token=tokenResult.data;meetingStore.setCapabilities(generation,token.role,token.state==="authorized"?capabilities(token.role,token):capabilities(token.role));
  if(token.state==="waiting"){bindSession(generation,request);meetingStore.transition(generation,"waiting",{waitingEntry:{id:token.waitingEntryId,status:"waiting"},providerStatus:"waiting_room"});return{ok:true,data:meetingStore.getSnapshot()};}
  if(!meetingStore.transition(generation,"connecting",{waitingEntry:null,providerStatus:"connecting"}))return stale();bindSession(generation,request);
  const connected=await meetingLiveKitAdapter.connect(token,request);if(meetingStore.getSnapshot().generation!==generation){await meetingLiveKitAdapter.disconnect();return stale();}
  if(!connected.ok){const error=fail(connected.error.code==="VOICE_PERMISSION_DENIED"?"MEETING_PERMISSION_DENIED":"MEETING_CONNECTION_FAILED",connected.error.message,true,connected.error.code);meetingStore.setError(generation,error);return{ok:false,error};}
  meetingStore.transition(generation,"connected",{providerStatus:"connected",error:null});applyProviderParticipants(generation,connected.data);return{ok:true,data:meetingStore.getSnapshot()};
}

function joinSerialized(request:MeetingClientJoinRequest,force=false):Promise<MeetingClientResult<MeetingClientSnapshot>> {
  const nextKey=keyOf(request);
  if(joinPromise){if(joinKey===nextKey)return joinPromise;return Promise.resolve({ok:false,error:fail("MEETING_JOIN_IN_PROGRESS","Finish the current meeting connection before joining another room.",true)});}
  joinKey=nextKey;
  joinPromise=performJoin(request,force).finally(()=>{joinPromise=null;joinKey=null;});
  return joinPromise;
}

export const meetingService = {
  store: meetingStore,
  prepare,
  join(request:MeetingClientJoinRequest,force=false):Promise<MeetingClientResult<MeetingClientSnapshot>> {return joinSerialized(request,force);},
  retry():Promise<MeetingClientResult<MeetingClientSnapshot>> {cancelMeetingReconnect();return currentRequest?joinSerialized(currentRequest,true):Promise.resolve({ok:false,error:fail("MEETING_CONTEXT_INVALID","Choose a meeting before retrying.",false)});},
  refreshAuthorization():Promise<MeetingClientResult<MeetingClientSnapshot>> {
    if(authorizationRefreshPromise)return authorizationRefreshPromise;
    if(joinPromise)return joinPromise;
    if(!currentRequest)return Promise.resolve({ok:false,error:fail("MEETING_CONTEXT_INVALID","Meeting authorization cannot be refreshed without an active room.",false)});
    const request=currentRequest;
    cancelMeetingReconnect();
    authorizationRefreshPromise=(async()=>{await prepare(request);return performJoin(request,true);})().finally(()=>{authorizationRefreshPromise=null;});
    return authorizationRefreshPromise;
  },
  async cancelWaitingRequest():Promise<MeetingClientResult<MeetingClientSnapshot>> {
    const snapshot=meetingStore.getSnapshot(),entry=snapshot.waitingEntry;
    if(!entry||entry.status!=="waiting")return{ok:false,error:fail("MEETING_WAITING","There is no active waiting-room request to cancel.",false)};
    const result=await meetingWaitingRoomService.cancel(entry.id);
    if(!result.ok)return{ok:false,error:fail("MEETING_WAITING",result.error.message,true,result.error.code)};
    meetingStore.patch(snapshot.generation,{waitingEntry:{id:result.data.id,status:result.data.status},providerStatus:"waiting_cancelled",error:null});
    return{ok:true,data:meetingStore.getSnapshot()};
  },
  async leave():Promise<void>{const generation=meetingStore.getSnapshot().generation,request=currentRequest;currentRequest=null;cancelMeetingReconnect();stopBindings();await meetingLiveKitAdapter.disconnect();if(request)await meetingScreenShareLeaseService.release(request.roomId,request.sessionId);const shield=noiseShieldService.deactivateMeeting();meetingStore.transition(generation,"ended",{providerStatus:"disconnected",waitingEntry:null,error:null,participantsById:{},participantIds:[],screenShares:[],localMedia:{muted:true,deafened:false,cameraEnabled:false,screenSharing:false},noiseShield:clientNoiseShield(shield)});},
  setLayout:meetingStore.setLayout,
  setRightDock:meetingStore.setRightDock,
  setFocus:meetingStore.setFocus,
  setNoiseShield:meetingStore.setNoiseShield,
  async setNoiseShieldMode(mode:NoiseShieldMode):Promise<boolean>{if(currentRequest)currentRequest={...currentRequest,noiseShield:mode!=="off",noiseShieldMode:mode};const state=noiseShieldService.requestMode(mode),generation=meetingStore.getSnapshot().generation;meetingStore.patch(generation,{noiseShield:clientNoiseShield(state)});const reapplied=await meetingLiveKitAdapter.reapplyNoiseShield();meetingStore.patch(generation,{noiseShield:clientNoiseShield(noiseShieldService.getSnapshot())});return reapplied},
  setVideoSubscriptions:meetingLiveKitAdapter.setVideoSubscriptionPlan,
  setCameraQualityPreset:(preset:MeetingCameraQualityPreset)=>meetingLiveKitAdapter.setCameraQualityPreset(preset),
  setFocusedScreenShare:meetingLiveKitAdapter.setFocusedScreenShare,
  async setMuted(muted:boolean):Promise<boolean>{const result=await meetingLiveKitAdapter.setMuted(muted);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,muted:result.data.muted}});return result.ok;},
  setDeafened(deafened:boolean):boolean{const result=meetingLiveKitAdapter.setDeafened(deafened);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,deafened:result.data.deafened}});return result.ok;},
  async setCameraEnabled(enabled:boolean,deviceId="default"):Promise<boolean>{const result=await meetingLiveKitAdapter.setCameraEnabled(enabled,deviceId);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,cameraEnabled:Boolean(result.data.cameraEnabled)}});return result.ok===true;},
  async startScreenShare(sourceId:string,sourceLabel?:string):Promise<boolean>{const request=currentRequest;if(!request||meetingStore.getSnapshot().screenShares?.some((share)=>!share.isLocal))return false;const lease=await meetingScreenShareLeaseService.claim(request.roomId,request.sessionId);if(!lease.ok)return false;const result=await meetingLiveKitAdapter.startScreenShare(sourceId,sourceLabel);if(!result.ok){await meetingScreenShareLeaseService.release(request.roomId,request.sessionId);return false}meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,screenSharing:Boolean(result.data.screenSharing)}});return true;},
  async stopScreenShare():Promise<boolean>{const request=currentRequest,result=await meetingLiveKitAdapter.stopScreenShare();if(request)await meetingScreenShareLeaseService.release(request.roomId,request.sessionId);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,screenSharing:false}});return result.ok;},
  sendReaction:meetingSignalService.sendReaction,
  applyHandAction:meetingSignalService.applyHandAction,
};
