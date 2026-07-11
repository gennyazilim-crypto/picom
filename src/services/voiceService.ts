import { ConnectionState, Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";
import { loggingService } from "./loggingService";
import { liveKitService } from "./livekit/livekitService";
import type { LiveKitIntent, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekit/livekitTypes";
import { getVoiceDurationBucket, normalizeVoiceConnectionQuality, type VoiceConnectionQuality, type VoiceDurationBucket } from "../utils/voiceQualityMetrics";
import { getScreenShareTrackConstraints, type ScreenShareQualityPresetId } from "../utils/screenShareQuality";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "./voiceDeviceService";
import type { MeetingParticipant, MeetingRoomContext, MeetingTransportConnectionState } from "../types/meeting";

export type VoiceConnectionStatus = MeetingTransportConnectionState;

export type VoiceIntent = LiveKitIntent;
export type VoiceTokenRequest = LiveKitTokenRequest;
export type VoiceTokenResponse = LiveKitTokenResponse;

export type VoiceJoinRequest = VoiceTokenRequest & Readonly<{
  communityName?: string;
  channelName?: string;
}>;

export type VoiceRoomContext = Pick<MeetingRoomContext, "communityId" | "communityName" | "channelId" | "channelName">;

export type VoiceParticipant = Pick<MeetingParticipant, "identity" | "name" | "isLocal" | "isSpeaking" | "isMicrophoneEnabled">;

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
  | "VOICE_SCREEN_SHARE_FAILED";

export type VoiceServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: VoiceServiceErrorCode; message: string } }>;

export type VoiceStateListener = (snapshot: VoiceServiceSnapshot) => void;

export type VoiceSessionDiagnosticsSummary = Readonly<{
  status: VoiceConnectionStatus;
  connected: boolean;
  participantCount: number;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  remoteScreenShareCount: number;
  lastErrorCode: VoiceServiceErrorCode | null;
  connectionQuality: VoiceConnectionQuality;
  reconnectCount: number;
  joinAttemptCount: number;
  joinFailureCount: number;
  deviceErrorCount: number;
  sessionDurationBucket: VoiceDurationBucket;
}>;

let room: Room | null = null;
let speakingIdentities = new Set<string>();
let screenShareMediaTrack: MediaStreamTrack | null = null;
let screenShares: VoiceScreenShare[] = [];
const remoteScreenShareTracks = new Map<string, MediaStreamTrack>();
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
  screenShares: [],
  participants: [],
  error: null,
  errorCode: null,
};

const listeners = new Set<VoiceStateListener>();

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
    },
    ...remoteParticipants,
  ];

  return Array.from(new Map(participants.map((participant) => [participant.identity, participant])).values());
}

function emitParticipants(activeRoom: Room): void {
  emit({ participants: getParticipants(activeRoom) });
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

function clearScreenShareState(): void {
  const localTrack = screenShareMediaTrack;
  screenShareMediaTrack = null;
  if (localTrack) {
    localTrack.onended = null;
    if (localTrack.readyState === "live") localTrack.stop();
  }
  setScreenShares(screenShares.filter((share) => !share.isLocal));
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
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      speakingIdentities.delete(participant.identity);
      removeParticipantScreenShares(participant.identity);
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      speakingIdentities = new Set(speakers.map((speaker) => speaker.identity));
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant.isLocal) connectionQuality = normalizeVoiceConnectionQuality(quality);
    })
    .on(RoomEvent.ParticipantNameChanged, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackMuted, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackUnmuted, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackPublished, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
      emitParticipants(activeRoom);
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
    })
    .on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
      }
    })
    .on(RoomEvent.Disconnected, () => {
      if (sessionStartedAtMs) lastSessionDurationMs = Date.now() - sessionStartedAtMs;
      sessionStartedAtMs = null;
      reconnectingActive = false;
      connectionQuality = "unknown";
      speakingIdentities = new Set<string>();
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

    if (desiredDeafened) applyRemoteAudioSubscription(activeRoom, false);
    emit({
      status: "connected",
      roomName: token.roomName,
      roomContext,
      participants: getParticipants(activeRoom),
      muted: desiredMuted || !microphoneEnabled || !token.canPublishAudio,
      deafened: desiredDeafened,
      canSpeak: token.canPublishAudio,
      canShareScreen: token.canPublishScreen,
      screenSharing: Boolean(screenShareMediaTrack),
      screenShares,
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
    emit({ roomContext, error: null, errorCode: null, participants: [], screenSharing: false, screenShares: [] });

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
      screenShares: [],
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
