import { ConnectionState, Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";
import { liveKitService } from "./livekit/livekitService";
import type { LiveKitIntent, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekit/livekitTypes";

export type VoiceConnectionStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "permission_denied"
  | "token_error"
  | "error"
  | "disconnected";

export type VoiceIntent = LiveKitIntent;
export type VoiceTokenRequest = LiveKitTokenRequest;
export type VoiceTokenResponse = LiveKitTokenResponse;

export type VoiceParticipant = Readonly<{
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMicrophoneEnabled: boolean;
}>;

export type VoiceScreenShare = Readonly<{
  id: string;
  participantIdentity: string;
  participantName: string;
  isLocal: boolean;
  stream: MediaStream;
}>;

export type VoiceServiceSnapshot = Readonly<{
  status: VoiceConnectionStatus;
  roomName: string | null;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  screenShares: VoiceScreenShare[];
  participants: VoiceParticipant[];
  error: string | null;
}>;

export type VoiceServiceErrorCode =
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_TOKEN_FAILED"
  | "VOICE_CONNECTION_FAILED"
  | "VOICE_ROOM_UNAVAILABLE"
  | "VOICE_PERMISSION_DENIED"
  | "VOICE_SCREEN_SHARE_FAILED";

export type VoiceServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: VoiceServiceErrorCode; message: string } }>;

export type VoiceStateListener = (snapshot: VoiceServiceSnapshot) => void;

let room: Room | null = null;
let speakingIdentities = new Set<string>();
let screenShareMediaTrack: MediaStreamTrack | null = null;
let screenShares: VoiceScreenShare[] = [];
let snapshot: VoiceServiceSnapshot = {
  status: "idle",
  roomName: null,
  muted: false,
  deafened: false,
  screenSharing: false,
  screenShares: [],
  participants: [],
  error: null,
};

const listeners = new Set<VoiceStateListener>();

function emit(next: Partial<VoiceServiceSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
}

function voiceError(code: VoiceServiceErrorCode, message: string): VoiceServiceResult<never> {
  const status: VoiceConnectionStatus =
    code === "VOICE_PERMISSION_DENIED" ? "permission_denied" : code === "VOICE_TOKEN_FAILED" ? "token_error" : "error";

  emit({
    error: message,
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

  return [
    {
      identity: activeRoom.localParticipant.identity,
      name: activeRoom.localParticipant.name || activeRoom.localParticipant.identity,
      isLocal: true,
      isSpeaking: speakingIdentities.has(activeRoom.localParticipant.identity),
      isMicrophoneEnabled: activeRoom.localParticipant.isMicrophoneEnabled,
    },
    ...remoteParticipants,
  ];
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
  setScreenShares(screenShares.filter((share) => share.id !== id));
}

function remoteScreenShareId(participantIdentity: string, trackSid: string): string {
  return `remote:${participantIdentity}:${trackSid}`;
}

function clearScreenShareState(): void {
  screenShareMediaTrack = null;
  setScreenShares(screenShares.filter((share) => !share.isLocal));
  emit({ screenSharing: false });
}

async function stopScreenShareInternal(activeRoom: Room): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
  const track = screenShareMediaTrack;

  if (!track) {
    emit({ screenSharing: false, participants: getParticipants(activeRoom) });
    return { ok: true, data: snapshot };
  }

  screenShareMediaTrack = null;

    try {
      await activeRoom.localParticipant.unpublishTrack(track, true);
      track.stop();
      setScreenShares(screenShares.filter((share) => !share.isLocal));
      emit({ screenSharing: false, error: null, participants: getParticipants(activeRoom) });
      return { ok: true, data: snapshot };
    } catch {
      track.stop();
      setScreenShares(screenShares.filter((share) => !share.isLocal));
      emit({
        screenSharing: false,
        participants: getParticipants(activeRoom),
      error: "Screen sharing stopped locally, but LiveKit unpublish failed.",
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
        if (snapshot.deafened) applyRemoteAudioSubscription(activeRoom, false);
        emit({ status: "connected", participants: getParticipants(activeRoom), error: null });
        return;
      }

      if (state === ConnectionState.Reconnecting) {
        emit({ status: "reconnecting" });
        return;
      }

      if (state === ConnectionState.Disconnected) {
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
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      speakingIdentities = new Set(speakers.map((speaker) => speaker.identity));
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.ParticipantNameChanged, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackMuted, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackUnmuted, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackPublished, () => emitParticipants(activeRoom))
    .on(RoomEvent.TrackUnpublished, () => emitParticipants(activeRoom))
    .on(RoomEvent.LocalTrackPublished, () => emitParticipants(activeRoom))
    .on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.ScreenShare) {
        clearScreenShareState();
      }
      emitParticipants(activeRoom);
    })
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
        upsertScreenShare({
          id: remoteScreenShareId(participant.identity, publication.trackSid),
          participantIdentity: participant.identity,
          participantName: participant.name || participant.identity,
          isLocal: false,
          stream: new MediaStream([track.mediaStreamTrack]),
        });
      }
    })
    .on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
      if (publication.source === Track.Source.ScreenShare) {
        removeScreenShare(remoteScreenShareId(participant.identity, publication.trackSid));
      }
    })
    .on(RoomEvent.Disconnected, () => {
      speakingIdentities = new Set<string>();
      screenShareMediaTrack = null;
      screenShares = [];
      emit({ status: "disconnected", participants: [], roomName: null, screenSharing: false, screenShares: [] });
    });
}

function stopLocalTracks(activeRoom: Room): void {
  activeRoom.localParticipant.trackPublications.forEach((publication) => {
    publication.track?.stop();
  });
  screenShareMediaTrack = null;
  screenShares = [];
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
  emit({ status: "requesting_token", error: null });

  const token = await liveKitService.fetchToken(request);
  if (!token.ok) {
    const code = token.error.code === "LIVEKIT_NOT_CONFIGURED" ? "VOICE_NOT_CONFIGURED" : "VOICE_TOKEN_FAILED";
    return voiceError(code, token.error.message);
  }

  return { ok: true, data: token.data };
}

async function connectWithToken(token: VoiceTokenResponse): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
  emit({ status: "connecting", roomName: token.roomName, error: null });

  const activeRoom = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  try {
    bindRoomEvents(activeRoom);
    await activeRoom.connect(token.url, token.token);

    let microphoneEnabled = true;
    try {
      await activeRoom.localParticipant.setMicrophoneEnabled(true);
    } catch {
      microphoneEnabled = false;
    }

    room = activeRoom;
    emit({
      status: "connected",
      roomName: token.roomName,
      participants: getParticipants(activeRoom),
      muted: !microphoneEnabled,
      screenSharing: Boolean(screenShareMediaTrack),
      screenShares,
      error: microphoneEnabled ? null : "Microphone permission was denied or no input device is available.",
    });

    return { ok: true, data: snapshot };
  } catch (error) {
    activeRoom.disconnect();
    const message = error instanceof Error ? error.message : "Could not join the voice room.";
    return voiceError("VOICE_CONNECTION_FAILED", message);
  }
}

export const voiceService = {
  getSnapshot(): VoiceServiceSnapshot {
    return snapshot;
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

  async join(request: VoiceTokenRequest): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (room) {
      room.disconnect();
      room = null;
    }
    speakingIdentities = new Set<string>();
    screenShareMediaTrack = null;
    screenShares = [];
    emit({ error: null, participants: [], screenSharing: false, screenShares: [] });

    const token = await requestToken(request);
    if (!token.ok) return token;

    return connectWithToken(token.data);
  },

  async leave(): Promise<void> {
    if (room) {
      stopLocalTracks(room);
      room.disconnect();
      room = null;
    }
    speakingIdentities = new Set<string>();

    emit({
      status: "disconnected",
      roomName: null,
      participants: [],
      muted: false,
      deafened: false,
      screenSharing: false,
      screenShares: [],
      error: null,
    });
  },

  async setMuted(muted: boolean): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before changing microphone state.");
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(!muted);
      emit({
        muted,
        error: null,
        participants: getParticipants(room),
        status: room.state === ConnectionState.Reconnecting ? "reconnecting" : "connected",
      });
      return { ok: true, data: snapshot };
    } catch {
      emit({ muted: true });
      return voiceError("VOICE_PERMISSION_DENIED", "Microphone permission was denied or unavailable.");
    }
  },

  setDeafened(deafened: boolean): VoiceServiceResult<VoiceServiceSnapshot> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before changing audio playback state.");
    }

    applyRemoteAudioSubscription(room, !deafened);

    emit({ deafened, error: null });
    return { ok: true, data: snapshot };
  },

  async startScreenShare(sourceId: string): Promise<VoiceServiceResult<VoiceServiceSnapshot>> {
    if (!room) {
      return voiceError("VOICE_ROOM_UNAVAILABLE", "Join a voice room before starting screen share.");
    }

    if (screenShareMediaTrack) {
      return { ok: true, data: snapshot };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return voiceError("VOICE_SCREEN_SHARE_FAILED", "Screen capture is not available in this runtime.");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(createElectronScreenShareConstraints(sourceId));
      const [track] = stream.getVideoTracks();
      if (!track) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        return voiceError("VOICE_SCREEN_SHARE_FAILED", "No screen video track was returned.");
      }

      try {
        await room.localParticipant.publishTrack(track, {
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
        participantIdentity: room.localParticipant.identity,
        participantName: room.localParticipant.name || room.localParticipant.identity,
        isLocal: true,
        stream: new MediaStream([track]),
      });

      track.onended = () => {
        if (screenShareMediaTrack === track && room) {
          void stopScreenShareInternal(room);
        }
      };

      emit({ screenSharing: true, error: null, participants: getParticipants(room) });
      return { ok: true, data: snapshot };
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
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
