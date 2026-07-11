import { ConnectionState, Room, RoomEvent, Track, VideoQuality, type RemoteParticipant } from "livekit-client";
import { loggingService } from "./loggingService";
import { liveKitService } from "./livekit/livekitService";
import type { LiveKitIntent, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekit/livekitTypes";
import { getVoiceDurationBucket, normalizeVoiceConnectionQuality, type VoiceConnectionQuality } from "../utils/voiceQualityMetrics";
import { getScreenShareTrackConstraints, type ScreenShareQualityPresetId } from "../utils/screenShareQuality";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "./voiceDeviceService";
import type { MeetingConnectionQuality, MeetingParticipant, MeetingRoomContext, MeetingTransportConnectionState } from "../types/meeting";
import type { MeetingVideoSubscriptionPlan } from "../types/meetingVideoGrid";
import { voiceDiagnosticsRegistry, type VoiceSessionDiagnosticsSummary } from "./voiceDiagnosticsRegistry";

export type { VoiceSessionDiagnosticsSummary } from "./voiceDiagnosticsRegistry";

export type VoiceConnectionStatus = MeetingTransportConnectionState;

export type VoiceIntent = LiveKitIntent;
export type VoiceTokenRequest = LiveKitTokenRequest;
export type VoiceTokenResponse = LiveKitTokenResponse;

export type VoiceJoinRequest = VoiceTokenRequest & Readonly<{
  communityName?: string;
  channelName?: string;
}>;

export type VoiceRoomContext = Pick<MeetingRoomContext, "communityId" | "communityName" | "channelId" | "channelName">;

export type VoiceParticipant = Pick<MeetingParticipant, "identity" | "name" | "isLocal" | "isSpeaking" | "isMicrophoneEnabled"> & Readonly<{
  isCameraEnabled: boolean;
  connectionQuality: MeetingConnectionQuality;
}>;

export type VoiceCameraTrack = Readonly<{
  id: string;
  participantIdentity: string;
  participantName: string;
  isLocal: boolean;
  stream: MediaStream;
}>;

export type VoiceScreenShare = Readonly<{
  id: string;
  participantIdentity: string;
  participantName: string;
  isLocal: boolean;
  stream: MediaStream;
  sourceLabel?: string;
}>;

export type VoiceServiceSnapshot = Readonly<{
  status: VoiceConnectionStatus;
  roomName: string | null;
  roomContext: VoiceRoomContext | null;
  muted: boolean;
  deafened: boolean;
  canSpeak?: boolean;
  canShareScreen?: boolean;
  screenSharing: boolean;
  cameraEnabled?: boolean;
  canUseCamera?: boolean;
  cameraTracks?: VoiceCameraTrack[];
  screenShares: VoiceScreenShare[];
  participants: VoiceParticipant[];
  error: string | null;
  errorCode: VoiceServiceErrorCode | null;
}>;

export type VoiceServiceErrorCode =
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_TOKEN_FAILED"
  | "VOICE_CONNECTION_FAILED"
  | "VOICE_ROOM_UNAVAILABLE"
  | "VOICE_PERMISSION_DENIED"
  | "VOICE_SCREEN_SHARE_CONFLICT"
  | "VOICE_SCREEN_SHARE_FAILED"
  | "VOICE_DATA_UNAVAILABLE";

export type VoiceServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: VoiceServiceErrorCode; message: string } }>;

export type VoiceStateListener = (snapshot: VoiceServiceSnapshot) => void;
export type VoiceDataPacket = Readonly<{topic:string;payload:Uint8Array;senderIdentity:string;receivedAt:string}>;
export type VoiceDataPacketListener = (packet:VoiceDataPacket)=>void;

let room: Room | null = null;
let speakingIdentities = new Set<string>();
let screenShareMediaTrack: MediaStreamTrack | null = null;
let screenShares: VoiceScreenShare[] = [];
const remoteScreenShareTracks = new Map<string, MediaStreamTrack>();
let cameraTracks: VoiceCameraTrack[] = [];
let videoSubscriptionPlan: MeetingVideoSubscriptionPlan = { visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 };
const participantConnectionQualities = new Map<string, MeetingConnectionQuality>();
let focusedScreenShareId: string | null = null;
let activeTokenIntent: VoiceIntent | null = null;
let connectionQuality: VoiceConnectionQuality = "unknown";
let reconnectCount = 0;
let joinAttemptCount = 0;
let joinFailureCount = 0;
let deviceErrorCount = 0;
let sessionStartedAtMs: number | null = null;
let lastSessionDurationMs: number | null = null;
let reconnectingActive = false;
let joinInFlight = false;
let lastJoinRequest: VoiceJoinRequest | null = null;
let reconnectInFlight: Promise<VoiceServiceResult<VoiceServiceSnapshot>> | null = null;
let reconnectGeneration = 0;
const reconnectBackoffMs = [0, 750, 2_000] as const;
let appliedInputPreferenceKey = "";
let appliedOutputDeviceId = "";
let snapshot: VoiceServiceSnapshot = {
  status: "idle",
  roomName: null,
  roomContext: null,
  muted: false,
  deafened: false,
  canSpeak: false,
  canShareScreen: false,
  screenSharing: false,
  cameraTracks: [],
  screenShares: [],
  participants: [],
  error: null,
  errorCode: null,
};

const listeners = new Set<VoiceStateListener>();
const dataPacketListeners = new Set<VoiceDataPacketListener>();

function hasScreenPublishToken(): boolean {
  return activeTokenIntent === "screen";
}

const waitForReconnectDelay = (delayMs: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, delayMs);
});

const canceledReconnectResult = (): VoiceServiceResult<VoiceServiceSnapshot> => ({
  ok: false,
  error: { code: "VOICE_ROOM_UNAVAILABLE", message: "Voice reconnect was canceled." },
});

function emit(next: Partial<VoiceServiceSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
}

function voiceError(code: VoiceServiceErrorCode, message: string): VoiceServiceResult<never> {
  const status: VoiceConnectionStatus =
    code === "VOICE_PERMISSION_DENIED" ? "permission_denied" : code === "VOICE_TOKEN_FAILED" ? "token_error" : "error";

  emit({
    error: message,
    errorCode: code,
    status,
  });

  return { ok: false, error: { code, message } };
}

function mapParticipant(participant: RemoteParticipant): VoiceParticipant {
  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal: false,
    isSpeaking: speakingIdentities.has(participant.identity),
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
    isCameraEnabled: participant.isCameraEnabled,
    connectionQuality: participantConnectionQualities.get(participant.identity) ?? "unknown",
  };
}

function getParticipants(activeRoom: Room): VoiceParticipant[] {
  const remoteParticipants = Array.from(activeRoom.remoteParticipants.values()).map(mapParticipant);
  const participants = [
    {
      identity: activeRoom.localParticipant.identity,
      name: activeRoom.localParticipant.name || activeRoom.localParticipant.identity,
      isLocal: true,
      isSpeaking: speakingIdentities.has(activeRoom.localParticipant.identity),
      isMicrophoneEnabled: activeRoom.localParticipant.isMicrophoneEnabled,
      isCameraEnabled: activeRoom.localParticipant.isCameraEnabled,
      connectionQuality: participantConnectionQualities.get(activeRoom.localParticipant.identity) ?? "unknown",
    },
    ...remoteParticipants,
  ];

  return Array.from(new Map(participants.map((participant) => [participant.identity, participant])).values());
}

function emitParticipants(activeRoom: Room): void {
  const remoteTracks = cameraTracks.filter((track) => !track.isLocal);
  const localTracks: VoiceCameraTrack[] = [];
  activeRoom.localParticipant.videoTrackPublications.forEach((publication) => {
    if (publication.source !== Track.Source.Camera || !publication.track?.mediaStreamTrack) return;
    localTracks.push({ id: `local:${activeRoom.localParticipant.identity}:${publication.trackSid}`, participantIdentity: activeRoom.localParticipant.identity, participantName: activeRoom.localParticipant.name || activeRoom.localParticipant.identity, isLocal: true, stream: new MediaStream([publication.track.mediaStreamTrack]) });
  });
  cameraTracks = [...remoteTracks, ...localTracks];
  emit({ participants: getParticipants(activeRoom), cameraTracks });
}

const remoteCameraId = (participantIdentity: string, trackSid: string) => `remote-camera:${participantIdentity}:${trackSid}`;

function upsertCameraTrack(track: VoiceCameraTrack): void {
  cameraTracks = [...cameraTracks.filter((current) => current.id !== track.id), track];
  emit({ cameraTracks });
}

function removeCameraTrack(id: string): void {
  cameraTracks = cameraTracks.filter((track) => track.id !== id);
  emit({ cameraTracks });
}

function removeParticipantCameraTracks(participantIdentity: string): void {
  cameraTracks = cameraTracks.filter((track) => track.participantIdentity !== participantIdentity);
  emit({ cameraTracks });
}

function videoQualityFor(identity: string, plan: MeetingVideoSubscriptionPlan): VideoQuality {
  if (identity === plan.focusedParticipantIdentity || plan.visibleTileCount <= 4) return VideoQuality.HIGH;
  if (plan.activeSpeakerIdentities.includes(identity) || plan.visibleTileCount <= 9) return VideoQuality.MEDIUM;
  return VideoQuality.LOW;
}

function applyRemoteVideoSubscriptionPlan(activeRoom: Room, plan: MeetingVideoSubscriptionPlan): void {
  const visible = new Set(plan.visibleParticipantIdentities);
  activeRoom.remoteParticipants.forEach((participant) => {
    participant.videoTrackPublications.forEach((publication) => {
      if (publication.source !== Track.Source.Camera) return;
      const subscribed = visible.has(participant.identity);
      publication.setSubscribed(subscribed);
      if (subscribed) publication.setVideoQuality(videoQualityFor(participant.identity, plan));
    });
  });
}

function applyRemoteAudioSubscription(activeRoom: Room, subscribed: boolean): void {
  activeRoom.remoteParticipants.forEach((participant) => {
    participant.audioTrackPublications.forEach((publication) => {
      publication.setSubscribed(subscribed);
    });
  });
}

function setScreenShares(nextShares: VoiceScreenShare[]): void {
  screenShares = nextShares;
  emit({ screenShares });
}

function upsertScreenShare(share: VoiceScreenShare): void {
  setScreenShares([...screenShares.filter((current) => current.id !== share.id), share]);
}

function removeScreenShare(id: string): void {
  const remoteTrack = remoteScreenShareTracks.get(id);
  if (remoteTrack) remoteTrack.onended = null;
  remoteScreenShareTracks.delete(id);
  if (focusedScreenShareId === id) focusedScreenShareId = null;
  setScreenShares(screenShares.filter((share) => share.id !== id));
}

function removeParticipantScreenShares(participantIdentity: string): void {
  const prefix = `remote:${participantIdentity}:`;
  screenShares.filter((share) => share.id.startsWith(prefix)).forEach((share) => removeScreenShare(share.id));
}

function clearRemoteScreenShareTracks(): void {
  remoteScreenShareTracks.forEach((track) => { track.onended = null; });
  remoteScreenShareTracks.clear();
}

function remoteScreenShareId(participantIdentity: string, trackSid: string): string {
  return `remote:${participantIdentity}:${trackSid}`;
}

function applyFocusedScreenShareSubscription(activeRoom: Room, requestedId: string | null = focusedScreenShareId): void {
  void import("./livekit/screenShareSubscriptionPolicy").then(({ applySingleScreenShareSubscription }) => {
    if (room === activeRoom) focusedScreenShareId = applySingleScreenShareSubscription(activeRoom, requestedId);
  });
}

function clearScreenShareState(): void {
  const localTrack = screenShareMediaTrack;
  screenShareMediaTrack = null;
  if (localTrack) {
    localTrack.onended = null;
    if (localTrack.readyState === "live") localTrack.stop();
  }
  setScreenShares(screenShares.filter((share) => !share.isLocal));
  if (focusedScreenShareId?.startsWith("local:")) focusedScreenShareId = null;
  emit({ screenSharing: false });
}

async function stopScreenShareInternal(activeRoom: Room, reason: "user" | "track_ended" = "user"): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
  const track = screenShareMediaTrack;

  if (!track) {
    emit({ screenSharing: false, participants: getParticipants(activeRoom) });
    return { ok: true, data: snapshot };
  }

  screenShareMediaTrack = null;
  track.onended = null;

    try {
      await activeRoom.localParticipant.unpublishTrack(track, true);
      if (track.readyState === "live") track.stop();
      setScreenShares(screenShares.filter((share) => !share.isLocal));
      emit({
        screenSharing: false,
        error: reason === "track_ended" ? "Screen sharing stopped because the selected source or system permission became unavailable." : null,
        errorCode: reason === "track_ended" ? "VOICE_SCREEN_SHARE_FAILED" : null,
        participants: getParticipants(activeRoom),
      });
      return { ok: true, data: snapshot };
    } catch {
      if (track.readyState === "live") track.stop();
      setScreenShares(screenShares.filter((share) => !share.isLocal));
      emit({
        screenSharing: false,
        participants: getParticipants(activeRoom),
      error: "Screen sharing stopped locally, but LiveKit unpublish failed.",
      errorCode: "VOICE_SCREEN_SHARE_FAILED",
    });
    return {
      ok: false,
      error: {
        code: "VOICE_SCREEN_SHARE_FAILED",
        message: "Screen sharing stopped locally, but LiveKit unpublish failed.",
      },
    };
  }
}


function bindRoomEvents(activeRoom: Room): void {
  activeRoom
    .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Connected) {
        const restoredFromReconnect = reconnectingActive;
        sessionStartedAtMs ??= Date.now();
        reconnectingActive = false;
        if (snapshot.deafened) applyRemoteAudioSubscription(activeRoom, false);
        applyRemoteVideoSubscriptionPlan(activeRoom, videoSubscriptionPlan);
        if (restoredFromReconnect) {
          void activeRoom.localParticipant.setMicrophoneEnabled(!snapshot.muted).catch(() => {
            deviceErrorCount += 1;
            emit({ muted: true, error: "Microphone state could not be restored after reconnect.", errorCode: "VOICE_PERMISSION_DENIED" });
          });
        }
        emit({ status: "connected", participants: getParticipants(activeRoom), error: null, errorCode: null });
        return;
      }

      if (state === ConnectionState.Reconnecting) {
        if (!reconnectingActive) reconnectCount += 1;
        reconnectingActive = true;
        emit({ status: "reconnecting" });
        return;
      }

      if (state === ConnectionState.Disconnected) {
        if (sessionStartedAtMs) lastSessionDurationMs = Date.now() - sessionStartedAtMs;
        sessionStartedAtMs = null;
        reconnectingActive = false;
        connectionQuality = "unknown";
        speakingIdentities = new Set<string>();
        emit({ status: "disconnected" });
      }
    })
    .on(RoomEvent.ParticipantConnected, () => {
      if (snapshot.deafened) applyRemoteAudioSubscription(activeRoom, false);
      applyRemoteVideoSubscriptionPlan(activeRoom, videoSubscriptionPlan);
      applyFocusedScreenShareSubscription(activeRoom);
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      speakingIdentities.delete(participant.identity);
      participantConnectionQualities.delete(participant.identity);
      removeParticipantScreenShares(participant.identity);
      removeParticipantCameraTracks(participant.identity);
      applyFocusedScreenShareSubscription(activeRoom);
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      speakingIdentities = new Set(speakers.map((speaker) => speaker.identity));
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      const normalized = normalizeVoiceConnectionQuality(quality) as MeetingConnectionQuality;
      participantConnectionQualities.set(participant.identity, normalized);
      if (participant.isLocal) connectionQuality = normalized;
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.DataReceived,(payload,participant,_kind,topic)=>{
      if(!participant||!topic||payload.byteLength>16_384)return;
      const packet:VoiceDataPacket={topic,payload:new Uint8Array(payload),senderIdentity:participant.identity,receivedAt:new Date().toISOString()};
      dataPacketListeners.forEach((listener)=>listener(packet));
    })
    .on(RoomEvent.ParticipantNameChanged, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackMuted, (publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
        applyFocusedScreenShareSubscription(activeRoom);
      }
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (publication.source === Track.Source.ScreenShare && publication.track?.kind === Track.Kind.Video) {
        const shareId = remoteScreenShareId(participant.identity, publication.trackSid);
        upsertScreenShare({ id: shareId, participantIdentity: participant.identity, participantName: participant.name || participant.identity, isLocal: false, stream: new MediaStream([publication.track.mediaStreamTrack]), sourceLabel: "Shared screen" });
      }
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackPublished, () => {
      applyRemoteVideoSubscriptionPlan(activeRoom, videoSubscriptionPlan);
      applyFocusedScreenShareSubscription(activeRoom);
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
      if (publication.source === Track.Source.Camera) removeCameraTrack(remoteCameraId(participant.identity, publication.trackSid));
      emitParticipants(activeRoom);
      applyFocusedScreenShareSubscription(activeRoom);
    })
    .on(RoomEvent.LocalTrackPublished, () => emitParticipants(activeRoom))
    .on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.ScreenShare) {
        clearScreenShareState();
      }
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
        const shareId = remoteScreenShareId(participant.identity, publication.trackSid);
        if (focusedScreenShareId && focusedScreenShareId !== shareId) {
          publication.setSubscribed(false);
          return;
        }
        const mediaTrack = track.mediaStreamTrack;
        const previousTrack = remoteScreenShareTracks.get(shareId);
        if (previousTrack) previousTrack.onended = null;
        remoteScreenShareTracks.set(shareId, mediaTrack);
        mediaTrack.onended = () => removeScreenShare(shareId);
        upsertScreenShare({
          id: shareId,
          participantIdentity: participant.identity,
          participantName: participant.name || participant.identity,
          isLocal: false,
          stream: new MediaStream([mediaTrack]),
          sourceLabel: "Shared screen",
        });
      }
      if (publication.source === Track.Source.Camera && track.kind === Track.Kind.Video) {
        upsertCameraTrack({ id: remoteCameraId(participant.identity, publication.trackSid), participantIdentity: participant.identity, participantName: participant.name || participant.identity, isLocal: false, stream: new MediaStream([track.mediaStreamTrack]) });
      }
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
        applyFocusedScreenShareSubscription(activeRoom);
      }
      if (publication.source === Track.Source.Camera) removeCameraTrack(remoteCameraId(participant.identity, publication.trackSid));
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
      const shareId = remoteScreenShareId(participant.identity, trackSid);
      removeScreenShare(shareId);
      applyFocusedScreenShareSubscription(activeRoom);
      emit({ error: "The shared screen could not be loaded. Picom will keep participant context available.", errorCode: "VOICE_SCREEN_SHARE_FAILED" });
    })
    .on(RoomEvent.Disconnected, () => {
      if (sessionStartedAtMs) lastSessionDurationMs = Date.now() - sessionStartedAtMs;
      sessionStartedAtMs = null;
      reconnectingActive = false;
      connectionQuality = "unknown";
        speakingIdentities = new Set<string>();
        participantConnectionQualities.clear();
        cameraTracks = [];
      stopLocalTracks(activeRoom);
      activeTokenIntent = null;
      activeRoom.removeAllListeners();
      if (room === activeRoom) room = null;
      emit({
        status: "disconnected",
        participants: [],
        roomName: null,
        roomContext: null,
        screenSharing: false,
        screenShares: [],
        cameraTracks: [],
        error: "This voice room ended or the connection was closed.",
        errorCode: "VOICE_ROOM_UNAVAILABLE",
      });
    });
}

function stopLocalTracks(activeRoom: Room): void {
  if (screenShareMediaTrack) screenShareMediaTrack.onended = null;
  activeRoom.localParticipant.trackPublications.forEach((publication) => {
    publication.track?.stop();
  });
  screenShareMediaTrack = null;
  screenShares = [];
  clearRemoteScreenShareTracks();
  cameraTracks = [];
  focusedScreenShareId = null;
}

function createElectronScreenShareConstraints(sourceId: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    } as unknown as MediaTrackConstraints,
  };
}

async function requestToken(request: VoiceTokenRequest): Promise<VoiceServiceResult<VoiceTokenResponse>> {
  emit({ status: "requesting_token", error: null, errorCode: null });

  const token = await liveKitService.fetchToken(request);
  if (!token.ok) {
    const code = token.error.code === "LIVEKIT_NOT_CONFIGURED" ? "VOICE_NOT_CONFIGURED" : "VOICE_TOKEN_FAILED";
    return voiceError(code, token.error.message);
  }

  return { ok: true, data: token.data };
}

function inputPreferenceKey(preferences: VoiceDeviceSnapshot): string {
  return [preferences.selectedInputId, preferences.echoCancellation, preferences.noiseSuppression, preferences.autoGainControl].join(":");
}

async function applyVoiceDevicePreferences(activeRoom: Room, preferences: VoiceDeviceSnapshot): Promise<void> {
  if (preferences.selectedOutputId !== appliedOutputDeviceId) {
    try {
      await activeRoom.switchActiveDevice("audiooutput", preferences.selectedOutputId, preferences.selectedOutputId !== "default");
      appliedOutputDeviceId = preferences.selectedOutputId;
    } catch (error) {
      deviceErrorCount += 1;
      loggingService.logWarn("LiveKit output device switch failed", { errorName: error instanceof Error ? error.name : "UnknownError" }, "voice");
    }
  }

  const nextInputKey = inputPreferenceKey(preferences);
  if (nextInputKey === appliedInputPreferenceKey) return;
  try {
    if (snapshot.muted) {
      await activeRoom.switchActiveDevice("audioinput", preferences.selectedInputId, preferences.selectedInputId !== "default");
    } else {
      await activeRoom.localParticipant.setMicrophoneEnabled(false);
      await activeRoom.localParticipant.setMicrophoneEnabled(true, voiceDeviceService.getAudioCaptureConstraints());
    }
    appliedInputPreferenceKey = nextInputKey;
    emit({ participants: getParticipants(activeRoom), error: null, errorCode: null });
  } catch (error) {
    deviceErrorCount += 1;
    emit({ error: "The selected microphone or processing options could not be applied.", errorCode: "VOICE_PERMISSION_DENIED" });
    loggingService.logWarn("LiveKit input device switch failed", { errorName: error instanceof Error ? error.name : "UnknownError" }, "voice");
  }
}

async function connectWithToken(
  token: VoiceTokenResponse,
  desiredMuted: boolean,
  desiredDeafened: boolean,
  roomContext: VoiceRoomContext,
  desiredCamera = false,
  cameraDeviceId = "default",
): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
  emit({ status: "connecting", roomName: token.roomName, roomContext, error: null, errorCode: null });

  const activeRoom = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  try {
    appliedInputPreferenceKey = "";
    appliedOutputDeviceId = "";
    room = activeRoom;
    bindRoomEvents(activeRoom);
    await activeRoom.connect(token.url, token.token);
    activeTokenIntent = token.intent;

    let microphoneEnabled = token.canPublishAudio;
    let cameraEnabled = false;
    try {
      const devicePreferences = voiceDeviceService.getSnapshot();
      if (token.canPublishAudio) {
        await activeRoom.localParticipant.setMicrophoneEnabled(!desiredMuted, voiceDeviceService.getAudioCaptureConstraints());
        appliedInputPreferenceKey = inputPreferenceKey(devicePreferences);
        await applyVoiceDevicePreferences(activeRoom, devicePreferences);
      }
    } catch {
      microphoneEnabled = false;
      deviceErrorCount += 1;
    }

    if (token.canPublishVideo && desiredCamera) {
      try {
        await activeRoom.localParticipant.setCameraEnabled(true, cameraDeviceId === "default" ? undefined : { deviceId: cameraDeviceId });
        cameraEnabled = true;
      } catch {
        deviceErrorCount += 1;
      }
    }

    if (desiredDeafened) applyRemoteAudioSubscription(activeRoom, false);
    applyRemoteVideoSubscriptionPlan(activeRoom, videoSubscriptionPlan);
    emitParticipants(activeRoom);
    emit({
      status: "connected",
      roomName: token.roomName,
      roomContext,
      participants: getParticipants(activeRoom),
      muted: desiredMuted || !microphoneEnabled || !token.canPublishAudio,
      deafened: desiredDeafened,
      canSpeak: token.canPublishAudio,
      canShareScreen: token.canPublishScreen,
      canUseCamera: Boolean(token.canPublishVideo),
      cameraEnabled,
      screenSharing: Boolean(screenShareMediaTrack),
      screenShares,
      cameraTracks,
      error: token.canPublishAudio && !microphoneEnabled ? "Microphone permission was denied or no input device is available." : null,
      errorCode: token.canPublishAudio && !microphoneEnabled ? "VOICE_PERMISSION_DENIED" : null,
    });

    return { ok: true, data: snapshot };
  } catch (error) {
    activeRoom.removeAllListeners();
    activeRoom.disconnect();
    if (room === activeRoom) room = null;
    activeTokenIntent = null;
    loggingService.logWarn("LiveKit room connection failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    }, "voice");
    return voiceError("VOICE_CONNECTION_FAILED", "Picom could not connect to this voice room. Check your network and try again.");
  }
}

voiceDeviceService.subscribePreferences((preferences) => {
  const activeRoom = room;
  if (activeRoom && activeRoom.state !== ConnectionState.Disconnected) void applyVoiceDevicePreferences(activeRoom, preferences);
});

export const voiceService = {
  getSnapshot(): VoiceServiceSnapshot {
    return snapshot;
  },

  getLocalParticipantIdentity():string|null{return room?.localParticipant.identity??null;},

  subscribeDataPackets(listener:VoiceDataPacketListener):()=>void{dataPacketListeners.add(listener);return()=>{dataPacketListeners.delete(listener)};},

  async publishDataPacket(topic:string,payload:Uint8Array,reliable=false):Promise<VoiceServiceResult<void>>{
    if(!room||room.state===ConnectionState.Disconnected)return{ok:false,error:{code:"VOICE_DATA_UNAVAILABLE",message:"Join the meeting before sending a signal."}};
    if(!/^[a-z0-9._-]{1,80}$/i.test(topic)||payload.byteLength<1||payload.byteLength>16_384)return{ok:false,error:{code:"VOICE_DATA_UNAVAILABLE",message:"The meeting signal payload is invalid."}};
    try{await room.localParticipant.publishData(payload,{reliable,topic});return{ok:true,data:undefined}}catch{return{ok:false,error:{code:"VOICE_DATA_UNAVAILABLE",message:"Picom could not send the meeting signal."}}}
  },

  getDiagnosticsSummary(): VoiceSessionDiagnosticsSummary {
    return {
      status: snapshot.status,
      connected: snapshot.status === "connected" || snapshot.status === "reconnecting",
      participantCount: snapshot.participants.length,
      muted: snapshot.muted,
      deafened: snapshot.deafened,
      screenSharing: snapshot.screenSharing,
      remoteScreenShareCount: snapshot.screenShares.filter((share) => !share.isLocal).length,
      lastErrorCode: snapshot.errorCode,
      connectionQuality,
      reconnectCount,
      joinAttemptCount,
      joinFailureCount,
      deviceErrorCount,
      sessionDurationBucket: getVoiceDurationBucket(sessionStartedAtMs ? Date.now() - sessionStartedAtMs : lastSessionDurationMs),
    };
  },

  subscribe(listener: VoiceStateListener): () => void {
    listeners.add(listener);
    listener(snapshot);

    return () => {
      listeners.delete(listener);
    };
  },

  setVideoSubscriptionPlan(plan: MeetingVideoSubscriptionPlan): boolean {
    videoSubscriptionPlan = plan;
    if (!room || room.state === ConnectionState.Disconnected) return false;
    applyRemoteVideoSubscriptionPlan(room, plan);
    return true;
  },

  setFocusedScreenShare(shareId: string | null): boolean {
    focusedScreenShareId = shareId;
    if (!room || room.state === ConnectionState.Disconnected) return false;
    applyFocusedScreenShareSubscription(room, shareId);
    return true;
  },

  async requestToken(request: VoiceTokenRequest): Promise<VoiceServiceResult<VoiceTokenResponse>> {
    return requestToken(request);
  },

  async join(request: VoiceJoinRequest): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (joinInFlight) {
      return { ok: true, data: snapshot };
    }

    const switchesRoom = Boolean(lastJoinRequest) && (
      lastJoinRequest?.communityId !== request.communityId
      || lastJoinRequest?.channelId !== request.channelId
    );
    if (switchesRoom) {
      reconnectGeneration += 1;
      reconnectInFlight = null;
    }
    joinInFlight = true;
    joinAttemptCount += 1;
    lastJoinRequest = request;
    const { communityName, channelName, ...tokenRequest } = request;
    const roomContext: VoiceRoomContext = {
      communityId: request.communityId,
      communityName,
      channelId: request.channelId,
      channelName,
    };
    const desiredMuted = snapshot.muted;
    const desiredDeafened = snapshot.deafened;
    if (room) {
      stopLocalTracks(room);
      room.removeAllListeners();
      room.disconnect();
      room = null;
      activeTokenIntent = null;
    }
    speakingIdentities = new Set<string>();
    screenShareMediaTrack = null;
    screenShares = [];
    clearRemoteScreenShareTracks();
    cameraTracks = [];
    participantConnectionQualities.clear();
    videoSubscriptionPlan = { visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 };
    focusedScreenShareId = null;
    emit({ roomContext, error: null, errorCode: null, participants: [], screenSharing: false, screenShares: [], cameraTracks: [] });

    try {
      const token = await requestToken(tokenRequest);
      if (!token.ok) {
        joinFailureCount += 1;
        return token;
      }

      const result = await connectWithToken(token.data, desiredMuted, desiredDeafened, roomContext);
      if (!result.ok) joinFailureCount += 1;
      return result;
    } finally {
      joinInFlight = false;
    }
  },

  async connectAuthorizedToken(token: VoiceTokenResponse, roomContext: VoiceRoomContext, options: Readonly<{muted?:boolean;cameraEnabled?:boolean;cameraDeviceId?:string}> = {}): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (joinInFlight) return { ok: true, data: snapshot };
    joinInFlight = true;
    joinAttemptCount += 1;
    lastJoinRequest = null;
    reconnectGeneration += 1;
    reconnectInFlight = null;
    const desiredMuted = options.muted ?? snapshot.muted;
    const desiredDeafened = snapshot.deafened;
    if (room) {
      stopLocalTracks(room);
      room.removeAllListeners();
      room.disconnect();
      room = null;
      activeTokenIntent = null;
    }
    speakingIdentities = new Set<string>();
    screenShareMediaTrack = null;
    screenShares = [];
    clearRemoteScreenShareTracks();
    cameraTracks = [];
    participantConnectionQualities.clear();
    videoSubscriptionPlan = { visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 };
    focusedScreenShareId = null;
    emit({ roomContext, error: null, errorCode: null, participants: [], screenSharing: false, screenShares: [], cameraTracks: [] });
    try {
      const result = await connectWithToken(token, desiredMuted, desiredDeafened, roomContext, Boolean(options.cameraEnabled), options.cameraDeviceId);
      if (!result.ok) joinFailureCount += 1;
      return result;
    } finally {
      joinInFlight = false;
    }
  },

  async reconnect(): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!lastJoinRequest) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before trying to reconnect.");
    }
    if (reconnectInFlight) return reconnectInFlight;

    const request = lastJoinRequest;
    const generation = ++reconnectGeneration;
    reconnectCount += 1;
    reconnectInFlight = (async () => {
      let lastResult: VoiceServiceResult<VoiceServiceSnapshot> = canceledReconnectResult();
      for (const delayMs of reconnectBackoffMs) {
        if (generation !== reconnectGeneration || lastJoinRequest !== request) return canceledReconnectResult();
        if (delayMs > 0) await waitForReconnectDelay(delayMs);
        if (generation !== reconnectGeneration || lastJoinRequest !== request) return canceledReconnectResult();
        lastResult = await voiceService.join(request);
        if (lastResult.ok) return lastResult;
        if (lastResult.error.code !== "VOICE_CONNECTION_FAILED" && lastResult.error.code !== "VOICE_ROOM_UNAVAILABLE") return lastResult;
      }
      return lastResult;
    })();

    try {
      return await reconnectInFlight;
    } finally {
      if (generation === reconnectGeneration) reconnectInFlight = null;
    }
  },

  canReconnect(): boolean {
    return Boolean(lastJoinRequest) && (
      snapshot.status === "disconnected"
      || snapshot.status === "reconnecting"
      || snapshot.errorCode === "VOICE_CONNECTION_FAILED"
      || snapshot.errorCode === "VOICE_ROOM_UNAVAILABLE"
    );
  },

  async leave(): Promise<void> {
    if (room) {
      stopLocalTracks(room);
      room.removeAllListeners();
      room.disconnect();
      room = null;
    }
    joinInFlight = false;
    lastJoinRequest = null;
    reconnectGeneration += 1;
    reconnectInFlight = null;
    reconnectingActive = false;
    sessionStartedAtMs = null;
    connectionQuality = "unknown";
    activeTokenIntent = null;
    speakingIdentities = new Set<string>();
    participantConnectionQualities.clear();
    videoSubscriptionPlan = { visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 };
    cameraTracks = [];
    focusedScreenShareId = null;

    emit({
      status: "disconnected",
      roomName: null,
      roomContext: null,
      participants: [],
      muted: false,
      deafened: false,
      canSpeak: false,
      canShareScreen: false,
      screenSharing: false,
      cameraEnabled: false,
      canUseCamera: false,
      screenShares: [],
      cameraTracks: [],
      error: null,
      errorCode: null,
    });
  },

  async setMuted(muted: boolean): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before changing microphone state.");
    }
    if (!muted && !snapshot.canSpeak) return voiceError("VOICE_PERMISSION_DENIED", "Your role cannot publish microphone audio in this room.");

    try {
      await room.localParticipant.setMicrophoneEnabled(!muted, voiceDeviceService.getAudioCaptureConstraints());
      if (!muted) appliedInputPreferenceKey = inputPreferenceKey(voiceDeviceService.getSnapshot());
      emit({
        muted,
        error: null,
        errorCode: null,
        participants: getParticipants(room),
        status: room.state === ConnectionState.Reconnecting ? "reconnecting" : "connected",
      });
      return { ok: true, data: snapshot };
    } catch {
      emit({ muted: true });
      deviceErrorCount += 1;
      return voiceError("VOICE_PERMISSION_DENIED", "Microphone permission was denied or unavailable.");
    }
  },

  setDeafened(deafened: boolean): VoiceServiceResult<VoiceServiceSnapshot> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before changing audio playback state.");
    }

    applyRemoteAudioSubscription(room, !deafened);

    emit({ deafened, error: null, errorCode: null });
    return { ok: true, data: snapshot };
  },

  async setCameraEnabled(enabled: boolean, deviceId = "default"): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a meeting before changing camera state.");
    if (enabled && !snapshot.canUseCamera) return voiceError("VOICE_PERMISSION_DENIED", "Your role cannot publish camera video in this room.");
    try {
      await room.localParticipant.setCameraEnabled(enabled, enabled && deviceId !== "default" ? { deviceId } : undefined);
      emit({ cameraEnabled: enabled, error: null, errorCode: null, participants: getParticipants(room) });
      return { ok: true, data: snapshot };
    } catch {
      deviceErrorCount += 1;
      emit({ cameraEnabled: false });
      return voiceError("VOICE_PERMISSION_DENIED", "Camera permission was denied or the selected camera is unavailable.");
    }
  },

  async startScreenShare(sourceId: string, preset: ScreenShareQualityPresetId = "balanced", sourceLabel?: string): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before starting screen share.");
    }
    if (!snapshot.canShareScreen) return voiceError("VOICE_PERMISSION_DENIED", "Your role cannot share a screen in this room.");

    if (screenShareMediaTrack) {
      return { ok: false, error: { code: "VOICE_SCREEN_SHARE_CONFLICT", message: "Stop the current screen share before choosing another source." } };
    }

    if (!/^(screen|window):[a-zA-Z0-9:_-]{1,240}$/.test(sourceId)) {
      return voiceError("VOICE_SCREEN_SHARE_FAILED", "The selected screen source is invalid or expired.");
    }

    if (!hasScreenPublishToken()) {
      if (!lastJoinRequest) return voiceError("VOICE_ROOM_UNAVAILABLE", "Rejoin the voice room before starting screen share.");
      const upgraded = await voiceService.join({ ...lastJoinRequest, intent: "screen" });
      if (!upgraded.ok) return upgraded;
      if (!room || !hasScreenPublishToken()) return voiceError("VOICE_SCREEN_SHARE_FAILED", "Screen-share permission could not be activated for this room.");
    }

    const activeRoom = room;
    if (!activeRoom) return voiceError("VOICE_ROOM_UNAVAILABLE", "The voice room disconnected before screen sharing started.");

    if (!navigator.mediaDevices?.getUserMedia) {
      return voiceError("VOICE_SCREEN_SHARE_FAILED", "Screen capture is not available in this runtime.");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(createElectronScreenShareConstraints(sourceId));
      const captureTrack = stream.getVideoTracks()[0];
      if (captureTrack) {
        await captureTrack.applyConstraints(getScreenShareTrackConstraints(preset)).catch(() => undefined);
      }
      const [track] = stream.getVideoTracks();
      if (!track) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        return voiceError("VOICE_SCREEN_SHARE_FAILED", "No screen video track was returned.");
      }

      try {
        await activeRoom.localParticipant.publishTrack(track, {
          name: "screen-share",
          source: Track.Source.ScreenShare,
        });
      } catch (error) {
        track.stop();
        throw error;
      }

      screenShareMediaTrack = track;
      upsertScreenShare({
        id: `local:${track.id}`,
        participantIdentity: activeRoom.localParticipant.identity,
        participantName: activeRoom.localParticipant.name || activeRoom.localParticipant.identity,
        isLocal: true,
        stream: new MediaStream([track]),
        sourceLabel: sourceLabel?.trim().slice(0, 80) || "Your shared screen",
      });

      track.onended = () => {
        if (screenShareMediaTrack === track && room === activeRoom) {
          void stopScreenShareInternal(activeRoom, "track_ended");
        }
      };

      emit({ screenSharing: true, error: null, errorCode: null, participants: getParticipants(activeRoom) });
      return { ok: true, data: snapshot };
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      loggingService.logWarn("LiveKit screen share start failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        permissionDenied: denied,
      }, "voice");
      return voiceError(
        denied ? "VOICE_PERMISSION_DENIED" : "VOICE_SCREEN_SHARE_FAILED",
        denied ? "Screen recording permission was denied." : "Could not start screen sharing."
      );
    }
  },

  async stopScreenShare(): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before stopping screen share.");
    }

    return stopScreenShareInternal(room);
  },
};

voiceDiagnosticsRegistry.setProvider(() => voiceService.getDiagnosticsSummary());
