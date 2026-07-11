import { meetingStore } from "../../stores/meetingStore";
import type { MeetingParticipantAuthority, MeetingParticipantStateSnapshot } from "../../types/meetingParticipantState";
import type { MeetingClientError, MeetingClientJoinRequest, MeetingClientParticipant, MeetingClientResult, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingCapabilities, MeetingRole } from "../../types/meeting";
import { voiceDeviceService } from "../voiceDeviceService";
import { meetingSignalService } from "./meetingSignalService";
import { getMeetingCapabilities } from "./meetingCapabilityService";
import { meetingLiveKitAdapter } from "./meetingLiveKitAdapter";
import { meetingRepository } from "./meetingRepository";

let currentRequest: MeetingClientJoinRequest | null = null;
let joinPromise: Promise<MeetingClientResult<MeetingClientSnapshot>> | null = null;
let joinKey: string | null = null;
let authorizationRefreshPromise: Promise<MeetingClientResult<MeetingClientSnapshot>> | null = null;
let sessionCleanups: Array<() => void> = [];

const keyOf = (request: MeetingClientJoinRequest) => `${request.roomId}:${request.sessionId}`;
const fail = (code: MeetingClientError["code"], message: string, recoverable = true, providerCode?: string): MeetingClientError => ({ code, message, recoverable, providerCode });
const stale = (): MeetingClientResult<MeetingClientSnapshot> => ({ ok: false, error: fail("MEETING_STALE_OPERATION", "A newer meeting action replaced this request.", true) });

function stopBindings(): void { for (const cleanup of sessionCleanups.splice(0)) cleanup(); meetingSignalService.stop(); }

function capabilities(role: MeetingRole, token?: Readonly<{ canPublishAudio:boolean;canPublishVideo:boolean;canPublishScreen:boolean;canPublishData:boolean }>): MeetingCapabilities {
  const base = getMeetingCapabilities(role);
  return token ? { ...base, canPublishAudio: base.canPublishAudio&&token.canPublishAudio, canPublishVideo: base.canPublishVideo&&token.canPublishVideo, canShareScreen: base.canShareScreen&&token.canPublishScreen, canReact: base.canReact&&token.canPublishData } : base;
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
  if (!previousLocal || !nextLocal || previousLocal.role === nextLocal.role) return;

  const nextCapabilities = capabilities(nextLocal.role);
  meetingStore.setCapabilities(generation, nextLocal.role, nextCapabilities);
  if (!nextCapabilities.canPublishAudio && !meetingStore.getSnapshot().localMedia.muted) {
    queueMicrotask(() => { void meetingService.setMuted(true); });
  }
  queueMicrotask(() => { void meetingService.refreshAuthorization(); });
}

function applyProviderParticipants(generation:number,snapshot:ReturnType<typeof meetingLiveKitAdapter.getSnapshot>):void {
  const current=meetingStore.getSnapshot(); if(current.generation!==generation)return;
  const byIdentity=new Map(current.participantIds.map((id)=>current.participantsById[id]).filter(Boolean).map((participant)=>[participant.identity,participant]));
  for(const item of snapshot.participants){const prior=byIdentity.get(item.identity);const cameraTrack=(snapshot.cameraTracks??[]).find((track)=>track.participantIdentity===item.identity);byIdentity.set(item.identity,{id:prior?.id??`provider:${item.identity}`,userId:prior?.userId,identity:item.identity,displayName:item.name,username:prior?.username,avatarUrl:prior?.avatarUrl,role:prior?.role??current.role??"participant",communityRole:prior?.communityRole,verification:prior?.verification,presence:snapshot.status==="reconnecting"?"reconnecting":"connected",isLocal:item.isLocal,isSpeaking:item.isSpeaking,microphoneEnabled:item.isMicrophoneEnabled,cameraEnabled:item.isCameraEnabled||Boolean(cameraTrack),cameraStream:cameraTrack?.stream,screenSharing:snapshot.screenShares.some((share)=>share.participantIdentity===item.identity),handRaised:prior?.handRaised??false,connectionQuality:item.connectionQuality})}
  meetingStore.replaceParticipants(generation,[...byIdentity.values()]);
}

function bindSession(generation:number,request:MeetingClientJoinRequest):void {
  stopBindings();
  sessionCleanups.push(meetingLiveKitAdapter.subscribe((provider)=>{
    if(meetingStore.getSnapshot().generation!==generation)return;
    const phase=provider.status==="connected"?"connected":provider.status==="reconnecting"?"reconnecting":provider.status==="disconnected"?"disconnected":provider.status==="connecting"?"connecting":provider.status==="requesting_token"?"token-loading":null;
    if(phase)meetingStore.transition(generation,phase,{providerStatus:provider.status,localMedia:{muted:provider.muted,deafened:provider.deafened,cameraEnabled:Boolean(provider.cameraEnabled),screenSharing:provider.screenSharing},error:null});
    else if(provider.errorCode)meetingStore.setError(generation,fail(provider.errorCode==="VOICE_PERMISSION_DENIED"?"MEETING_PERMISSION_DENIED":"MEETING_PROVIDER_ERROR",provider.error??"The meeting provider reported an error.",true,provider.errorCode));
    meetingStore.patch(generation,{screenShares:provider.screenShares});
    applyProviderParticipants(generation,provider);
  }));
  sessionCleanups.push(meetingRepository.subscribe(request.roomId,request.sessionId,{
    onParticipants:(snapshot:MeetingParticipantStateSnapshot)=>applyAuthoritativeParticipants(generation,snapshot),
    onWaitingEntry:(entry)=>{if(meetingStore.getSnapshot().generation!==generation)return;if(entry.userId!==meetingStore.getSnapshot().participantsById[meetingStore.getSnapshot().participantIds.find((id)=>meetingStore.getSnapshot().participantsById[id]?.isLocal)??""]?.userId&&meetingStore.getSnapshot().waitingEntry?.id!==entry.id)return;meetingStore.patch(generation,{waitingEntry:{id:entry.id,status:entry.status}});if(entry.status==="admitted"&&currentRequest)void meetingService.join(currentRequest,true);if(entry.status==="denied"||entry.status==="expired")meetingStore.setError(generation,fail("MEETING_ADMISSION_DENIED","The host did not admit this meeting request.",entry.status==="expired"));},
    onRealtimeStatus:(realtimeStatus)=>meetingStore.patch(generation,{realtimeStatus}),
    onError:(message)=>meetingStore.patch(generation,{error:fail("MEETING_PROVIDER_ERROR",message,true)}),
  }));
  sessionCleanups.push(meetingSignalService.start({roomId:request.roomId,sessionId:request.sessionId}));
  sessionCleanups.push(meetingSignalService.subscribeReactions((reaction)=>meetingStore.appendReaction(generation,{id:reaction.eventId,senderIdentity:reaction.senderIdentity,kind:reaction.kind,createdAt:reaction.sentAt,expiresAt:reaction.expiresAt})));
  sessionCleanups.push(meetingSignalService.subscribeHandQueue(request.roomId,request.sessionId,{onSnapshot:(queue)=>{const current=meetingStore.getSnapshot();const participants=current.participantIds.map((id)=>current.participantsById[id]).filter(Boolean);const handByParticipant=new Map(queue.entries.map((entry)=>[entry.participantId,entry.handRaised]));const next=participants.map((participant)=>handByParticipant.has(participant.id)?{...participant,handRaised:handByParticipant.get(participant.id)??false}:participant);const local=next.find((participant)=>participant.isLocal);meetingStore.replaceParticipants(generation,next);meetingStore.patch(generation,{handRaised:local?.handRaised??false,stageQueue:queue.entries});},onStatus:(realtimeStatus)=>meetingStore.patch(generation,{realtimeStatus}),onError:(message)=>meetingStore.patch(generation,{error:fail("MEETING_PROVIDER_ERROR",message,true)})}));
  sessionCleanups.push(voiceDeviceService.subscribe((devices)=>meetingStore.patch(generation,{localDevices:{inputId:devices.selectedInputId,outputId:devices.selectedOutputId,permission:devices.permission}})));
}

async function prepare(request:MeetingClientJoinRequest):Promise<number> {
  stopBindings(); await meetingLiveKitAdapter.disconnect(); currentRequest=request;
  const generation=meetingStore.begin({roomId:request.roomId,sessionId:request.sessionId,communityId:request.communityId,communityName:request.communityName,channelId:request.channelId,channelName:request.channelName,roomTitle:request.roomTitle,roomMode:request.roomMode});
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

export const meetingService = {
  store: meetingStore,
  prepare,
  join(request:MeetingClientJoinRequest,force=false):Promise<MeetingClientResult<MeetingClientSnapshot>> {
    const nextKey=keyOf(request);if(joinPromise){if(joinKey===nextKey)return joinPromise;return Promise.resolve({ok:false,error:fail("MEETING_JOIN_IN_PROGRESS","Finish the current meeting connection before joining another room.",true)});}
    joinKey=nextKey;joinPromise=performJoin(request,force).finally(()=>{joinPromise=null;joinKey=null});return joinPromise;
  },
  retry():Promise<MeetingClientResult<MeetingClientSnapshot>> {return currentRequest?this.join(currentRequest,true):Promise.resolve({ok:false,error:fail("MEETING_CONTEXT_INVALID","Choose a meeting before retrying.",false)});},
  refreshAuthorization():Promise<MeetingClientResult<MeetingClientSnapshot>> {
    if(authorizationRefreshPromise)return authorizationRefreshPromise;
    if(joinPromise)return joinPromise;
    if(!currentRequest)return Promise.resolve({ok:false,error:fail("MEETING_CONTEXT_INVALID","Meeting authorization cannot be refreshed without an active room.",false)});
    const request=currentRequest;
    authorizationRefreshPromise=(async()=>{await prepare(request);return performJoin(request,true);})().finally(()=>{authorizationRefreshPromise=null;});
    return authorizationRefreshPromise;
  },
  async leave():Promise<void>{const generation=meetingStore.getSnapshot().generation;stopBindings();await meetingLiveKitAdapter.disconnect();meetingStore.transition(generation,"ended",{providerStatus:"disconnected",waitingEntry:null,error:null});currentRequest=null;},
  setLayout:meetingStore.setLayout,
  setRightDock:meetingStore.setRightDock,
  setFocus:meetingStore.setFocus,
  setNoiseShield:meetingStore.setNoiseShield,
  setVideoSubscriptions:meetingLiveKitAdapter.setVideoSubscriptionPlan,
  setFocusedScreenShare:meetingLiveKitAdapter.setFocusedScreenShare,
  async setMuted(muted:boolean):Promise<boolean>{const result=await meetingLiveKitAdapter.setMuted(muted);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,muted:result.data.muted}});return result.ok;},
  setDeafened(deafened:boolean):boolean{const result=meetingLiveKitAdapter.setDeafened(deafened);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,deafened:result.data.deafened}});return result.ok;},
  async setCameraEnabled(enabled:boolean,deviceId="default"):Promise<boolean>{const result=await meetingLiveKitAdapter.setCameraEnabled(enabled,deviceId);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,cameraEnabled:Boolean(result.data.cameraEnabled)}});return result.ok===true;},
  async startScreenShare(sourceId:string,sourceLabel?:string):Promise<boolean>{const result=await meetingLiveKitAdapter.startScreenShare(sourceId,sourceLabel);if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,screenSharing:Boolean(result.data.screenSharing)}});return result.ok===true;},
  async stopScreenShare():Promise<boolean>{const result=await meetingLiveKitAdapter.stopScreenShare();if(result.ok)meetingStore.patch(meetingStore.getSnapshot().generation,{localMedia:{...meetingStore.getSnapshot().localMedia,screenSharing:false}});return result.ok;},
  sendReaction:meetingSignalService.sendReaction,
  applyHandAction:meetingSignalService.applyHandAction,
};
