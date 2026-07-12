import type { MeetingClientPhase } from "../types/meetingClient";
import type { MeetingConnectionQuality } from "../types/meeting";
import { loggingService } from "./loggingService";

export type MeetingFailureDomain = "none" | "provider" | "network" | "client_permission" | "client_device" | "access_policy" | "configuration" | "unknown";
export type MeetingJoinLatencyBucket = "none" | "under_1s" | "1_to_3s" | "3_to_8s" | "over_8s";
export type MeetingTrackSource = "microphone" | "camera" | "screen_share";

export type MeetingDiagnosticsSummary = Readonly<{
  collectionPolicy: "local_ephemeral_aggregate";
  exportConsent: "explicit_user_action";
  remoteUploadEnabled: false;
  phase: MeetingClientPhase;
  providerStatus: string;
  providerRegion: string;
  joinAttemptCount: number;
  joinSuccessCount: number;
  joinFailureCount: number;
  tokenFailureCount: number;
  lastJoinLatencyBucket: MeetingJoinLatencyBucket;
  reconnectCount: number;
  participantCount: number;
  peakParticipantCount: number;
  connectionQuality: MeetingConnectionQuality;
  connectionQualityCounts: Readonly<Record<MeetingConnectionQuality, number>>;
  stateTransitionCounts: Readonly<Record<string, number>>;
  lastTransition: string | null;
  trackPublishFailureCount: number;
  trackPublishFailuresBySource: Readonly<Record<MeetingTrackSource, number>>;
  screenShareFailureCount: number;
  captionFailureCount: number;
  lastErrorCode: string | null;
  lastFailureDomain: MeetingFailureDomain;
  lastFailureOperation: string | null;
  deviceCapabilities: Readonly<{
    mediaCaptureApi: boolean;
    screenCaptureBridge: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
  }>;
}>;

const qualityCounts=():Record<MeetingConnectionQuality,number>=>({excellent:0,good:0,poor:0,unknown:0});
let lastGeneration=0;
let state:Omit<MeetingDiagnosticsSummary,"providerRegion"|"deviceCapabilities">={
  collectionPolicy:"local_ephemeral_aggregate",exportConsent:"explicit_user_action",remoteUploadEnabled:false,
  phase:"idle",providerStatus:"idle",joinAttemptCount:0,joinSuccessCount:0,joinFailureCount:0,tokenFailureCount:0,lastJoinLatencyBucket:"none",reconnectCount:0,
  participantCount:0,peakParticipantCount:0,connectionQuality:"unknown",connectionQualityCounts:qualityCounts(),stateTransitionCounts:{},lastTransition:null,
  trackPublishFailureCount:0,trackPublishFailuresBySource:{microphone:0,camera:0,screen_share:0},screenShareFailureCount:0,captionFailureCount:0,
  lastErrorCode:null,lastFailureDomain:"none",lastFailureOperation:null,
};

const clock=()=>typeof performance!=="undefined"&&typeof performance.now==="function"?performance.now():Date.now();
const safeCode=(value:string|null|undefined,fallback="UNKNOWN"):string=>{const normalized=(value??fallback).trim().toUpperCase().replace(/[^A-Z0-9_:-]+/g,"_").slice(0,64);return normalized||fallback};
const safeStatus=(value:string|null|undefined):string=>{const normalized=(value??"unknown").trim().toLowerCase().replace(/[^a-z0-9_:-]+/g,"_").slice(0,48);return normalized||"unknown"};
const latencyBucket=(milliseconds:number):MeetingJoinLatencyBucket=>milliseconds<1_000?"under_1s":milliseconds<3_000?"1_to_3s":milliseconds<8_000?"3_to_8s":"over_8s";
function failureDomain(code:string):MeetingFailureDomain{if(/NOT_CONFIGURED|CONFIG|MISSING/.test(code))return"configuration";if(/OS_PERMISSION|PERMISSION_DENIED|NOT_ALLOWED/.test(code))return"client_permission";if(/DEVICE|MICROPHONE|CAMERA|CAPTURE/.test(code))return"client_device";if(/DENIED|FORBIDDEN|REVOKED|POLICY|ADMISSION|WAITING/.test(code))return"access_policy";if(/OFFLINE|NETWORK|TIMEOUT|RECONNECT/.test(code))return"network";if(/PROVIDER|LIVEKIT|TOKEN|ROOM_UNAVAILABLE|CONNECTION_FAILED/.test(code))return"provider";return"unknown"}
function deviceCapabilities():MeetingDiagnosticsSummary["deviceCapabilities"]{const media=typeof navigator!=="undefined"?navigator.mediaDevices:undefined;const supported=media?.getSupportedConstraints?.()??{};return{mediaCaptureApi:typeof media?.getUserMedia==="function",screenCaptureBridge:typeof window!=="undefined"&&typeof window.picomDesktop?.screenCapture?.getSources==="function",noiseSuppression:supported.noiseSuppression===true,echoCancellation:supported.echoCancellation===true,autoGainControl:supported.autoGainControl===true}}
function providerRegion():string{const value=(import.meta.env.VITE_LIVEKIT_REGION??"").trim().toLowerCase();return/^[a-z0-9][a-z0-9-]{1,31}$/.test(value)?value:"unknown"}
function aggregateQuality(values:readonly MeetingConnectionQuality[]):{quality:MeetingConnectionQuality;counts:Record<MeetingConnectionQuality,number>}{const counts=qualityCounts();for(const value of values)counts[value]+=1;const quality=counts.poor?"poor":counts.good?"good":counts.excellent?"excellent":"unknown";return{quality,counts}}
function recordFailure(operation:string,errorCode:string):void{const code=safeCode(errorCode);state={...state,lastErrorCode:code,lastFailureDomain:failureDomain(code),lastFailureOperation:safeStatus(operation)};loggingService.logWarn("Meeting operation failed",{operation:safeStatus(operation),code,domain:state.lastFailureDomain},"meeting-diagnostics")}

export const meetingDiagnosticsRegistry={
  beginJoin():number{state={...state,joinAttemptCount:state.joinAttemptCount+1};return clock()},
  completeJoin(startedAt:number,outcome:"connected"|"waiting"|"failed",errorCode?:string):void{const bucket=latencyBucket(Math.max(0,clock()-startedAt));state={...state,lastJoinLatencyBucket:bucket,joinSuccessCount:state.joinSuccessCount+(outcome==="connected"?1:0),joinFailureCount:state.joinFailureCount+(outcome==="failed"?1:0)};if(outcome==="failed")recordFailure("join",errorCode??"MEETING_JOIN_FAILED")},
  recordTokenFailure(errorCode:string):void{state={...state,tokenFailureCount:state.tokenFailureCount+1};recordFailure("token",errorCode)},
  observeSnapshot(input:Readonly<{generation:number;phase:MeetingClientPhase;providerStatus:string;participantQualities:readonly MeetingConnectionQuality[];errorCode?:string|null}>):void{if(input.generation!==lastGeneration){lastGeneration=input.generation}const transition=input.phase!==state.phase?`${state.phase}->${input.phase}`:null;const transitions={...state.stateTransitionCounts};if(transition)transitions[transition]=(transitions[transition]??0)+1;const aggregate=aggregateQuality(input.participantQualities);state={...state,phase:input.phase,providerStatus:safeStatus(input.providerStatus),participantCount:input.participantQualities.length,peakParticipantCount:Math.max(state.peakParticipantCount,input.participantQualities.length),connectionQuality:aggregate.quality,connectionQualityCounts:aggregate.counts,stateTransitionCounts:transitions,lastTransition:transition??state.lastTransition,reconnectCount:state.reconnectCount+(transition?.endsWith("->reconnecting")?1:0)};if(input.errorCode&&safeCode(input.errorCode)!==state.lastErrorCode)recordFailure("state",input.errorCode)},
  recordTrackPublishFailure(source:MeetingTrackSource,errorCode:string):void{state={...state,trackPublishFailureCount:state.trackPublishFailureCount+1,trackPublishFailuresBySource:{...state.trackPublishFailuresBySource,[source]:state.trackPublishFailuresBySource[source]+1}};recordFailure(`publish_${source}`,errorCode)},
  recordScreenShareFailure(errorCode:string):void{state={...state,screenShareFailureCount:state.screenShareFailureCount+1,trackPublishFailureCount:state.trackPublishFailureCount+1,trackPublishFailuresBySource:{...state.trackPublishFailuresBySource,screen_share:state.trackPublishFailuresBySource.screen_share+1}};recordFailure("screen_share",errorCode)},
  recordCaptionFailure(errorCode:string):void{state={...state,captionFailureCount:state.captionFailureCount+1};recordFailure("captions",errorCode)},
  getSummary():MeetingDiagnosticsSummary{return{...state,connectionQualityCounts:{...state.connectionQualityCounts},stateTransitionCounts:{...state.stateTransitionCounts},trackPublishFailuresBySource:{...state.trackPublishFailuresBySource},providerRegion:providerRegion(),deviceCapabilities:deviceCapabilities()}},
};
