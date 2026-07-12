import type { MeetingClientJoinRequest } from "../../types/meetingClient";
import type { MeetingRole } from "../../types/meeting";
import { dataSourceService } from "../dataSourceService";
import type { MeetingTokenAuthorizedResponse, MeetingTokenResponse, MeetingTokenResult } from "../livekit/meetingTokenTypes";
import { meetingTokenService } from "../livekit/meetingTokenService";
import { voiceService, type VoiceServiceResult, type VoiceServiceSnapshot, type VoiceTokenResponse } from "../voiceService";
import type { MeetingVideoSubscriptionPlan } from "../../types/meetingVideoGrid";
import { noiseShieldService } from "../noiseShieldService";

type Listener = (snapshot: VoiceServiceSnapshot) => void;
const mockListeners = new Set<Listener>();
let mockSnapshot: VoiceServiceSnapshot = { status: "idle", roomName: null, roomContext: null, muted: true, deafened: false, canSpeak: false, canShareScreen: false, screenSharing: false, cameraTracks: [], screenShares: [], participants: [], error: null, errorCode: null };
const publishMock = (patch: Partial<VoiceServiceSnapshot>) => { mockSnapshot = { ...mockSnapshot, ...patch }; for (const listener of mockListeners) listener(mockSnapshot); };

function mockAuthorization(request: MeetingClientJoinRequest): MeetingTokenResult {
  if (request.mockDisposition === "failed") return { ok: false, error: { code: "MEETING_TOKEN_FAILED", message: "Mock authorization was configured to fail." } };
  const role: MeetingRole = request.mockRole ?? "participant";
  if (request.mockDisposition === "waiting") return { ok: true, data: { state: "waiting", roomId: request.roomId, sessionId: request.sessionId, communityId: request.communityId, role, waitingEntryId: `mock-waiting-${request.sessionId}`, canSubscribe: true } };
  return { ok: true, data: { state: "authorized", token: "mock-local-meeting-authorization", url: "wss://mock.invalid", roomId: request.roomId, sessionId: request.sessionId, communityId: request.communityId, roomName: `meeting-${request.roomId}`, identity: "mock-local-participant", participantName: request.participantName ?? "Mock participant", role, canSubscribe: true, canPublishAudio: request.requestedSources.microphone, canPublishVideo: request.requestedSources.camera, canPublishScreen: request.requestedSources.screenShare, canPublishData: request.requestedSources.data, expiresAt: new Date(Date.now()+15*60_000).toISOString() } };
}

function voiceToken(token: MeetingTokenAuthorizedResponse, request: MeetingClientJoinRequest): VoiceTokenResponse {
  return { token: token.token, url: token.url, roomName: token.roomName, identity: token.identity, participantName: token.participantName, intent: request.requestedSources.screenShare ? "screen" : "voice", canPublishAudio: token.canPublishAudio, canPublishVideo: token.canPublishVideo, canPublishScreen: token.canPublishScreen, expiresAt: token.expiresAt };
}

export const meetingLiveKitAdapter = {
  authorize(request: MeetingClientJoinRequest): Promise<MeetingTokenResult> { return dataSourceService.getStatus().isMock ? Promise.resolve(mockAuthorization(request)) : meetingTokenService.fetchToken({ roomId: request.roomId, sessionId: request.sessionId, requestedSources: request.requestedSources }); },
  async connect(token: MeetingTokenResponse, request: MeetingClientJoinRequest): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (token.state !== "authorized") return { ok: false, error: { code: "VOICE_PERMISSION_DENIED", message: "The meeting is waiting for host admission." } };
    if (dataSourceService.getStatus().isMock) {
      publishMock({ status: "connecting", roomName: token.roomName, roomContext: { communityId: request.communityId, communityName: request.communityName, channelId: request.channelId, channelName: request.channelName }, error: null, errorCode: null });
      publishMock({ status: "connected", muted: !token.canPublishAudio, canSpeak: token.canPublishAudio, canShareScreen: token.canPublishScreen, participants: [{ identity: token.identity, name: token.participantName, isLocal: true, isSpeaking: false, isMicrophoneEnabled: token.canPublishAudio, isCameraEnabled: request.joinCameraOff === false, connectionQuality: "excellent" }], error: null, errorCode: null });
      return { ok: true, data: mockSnapshot };
    }
    return voiceService.connectAuthorizedToken(voiceToken(token, request), { communityId: request.communityId, communityName: request.communityName, channelId: request.channelId, channelName: request.channelName }, { muted: request.joinMuted !== false, cameraEnabled: request.joinCameraOff === false, cameraDeviceId: request.cameraDeviceId });
  },
  subscribe(listener: Listener): () => void {
    if (!dataSourceService.getStatus().isMock) return voiceService.subscribe(listener);
    mockListeners.add(listener); listener(mockSnapshot); return () => mockListeners.delete(listener);
  },
  getSnapshot(): VoiceServiceSnapshot { return dataSourceService.getStatus().isMock ? mockSnapshot : voiceService.getSnapshot(); },
  async disconnect(): Promise<void> { if (dataSourceService.getStatus().isMock) publishMock({ status: "disconnected", roomName: null, roomContext: null, participants: [], screenSharing: false, screenShares: [] }); else await voiceService.leave(); },
  setMuted(muted: boolean) { if (dataSourceService.getStatus().isMock) { publishMock({ muted }); return Promise.resolve({ ok: true, data: mockSnapshot } as const); } return voiceService.setMuted(muted); },
  setDeafened(deafened: boolean) { if (dataSourceService.getStatus().isMock) { publishMock({ deafened }); return { ok: true, data: mockSnapshot } as const; } return voiceService.setDeafened(deafened); },
  setCameraEnabled(enabled: boolean, deviceId = "default") { if (dataSourceService.getStatus().isMock) { publishMock({ cameraEnabled: enabled, participants: mockSnapshot.participants.map((participant) => participant.isLocal ? { ...participant, isCameraEnabled: enabled } : participant) }); return Promise.resolve({ ok: true, data: mockSnapshot } as const); } return voiceService.setCameraEnabled(enabled, deviceId); },
  startScreenShare(sourceId: string, sourceLabel?: string) { if (dataSourceService.getStatus().isMock) { publishMock({ screenSharing: true }); return Promise.resolve({ ok: true, data: mockSnapshot } as const); } return voiceService.startScreenShare(sourceId, "balanced", sourceLabel); },
  stopScreenShare() { if (dataSourceService.getStatus().isMock) { publishMock({ screenSharing: false, screenShares: mockSnapshot.screenShares.filter((share) => !share.isLocal) }); return Promise.resolve({ ok: true, data: mockSnapshot } as const); } return voiceService.stopScreenShare(); },
  setVideoSubscriptionPlan(plan: MeetingVideoSubscriptionPlan) { return dataSourceService.getStatus().isMock || voiceService.setVideoSubscriptionPlan(plan); },
  setFocusedScreenShare(shareId: string | null) { return dataSourceService.getStatus().isMock || voiceService.setFocusedScreenShare(shareId); },
  setParticipantLocalVolume(participantIdentity: string, volume: number) { return dataSourceService.getStatus().isMock || voiceService.setRemoteParticipantVolume(participantIdentity, volume); },
  async reapplyNoiseShield():Promise<boolean>{if(dataSourceService.getStatus().isMock){noiseShieldService.markApplied(noiseShieldService.getSnapshot().appliedMode);return true}return voiceService.reapplyMicrophoneProcessing()},
};
