import { ConnectionState, Room, RoomEvent, type RemoteParticipant } from "livekit-client";
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
  | "disconnected";

export type VoiceIntent = LiveKitIntent;
export type VoiceTokenRequest = LiveKitTokenRequest;
export type VoiceTokenResponse = LiveKitTokenResponse;

export type VoiceParticipant = Readonly<{
  identity: string;
  name: string;
  isLocal: boolean;
}>;

export type VoiceServiceSnapshot = Readonly<{
  status: VoiceConnectionStatus;
  roomName: string | null;
  muted: boolean;
  deafened: boolean;
  participants: VoiceParticipant[];
  error: string | null;
}>;

export type VoiceServiceErrorCode =
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_TOKEN_FAILED"
  | "VOICE_CONNECTION_FAILED"
  | "VOICE_ROOM_UNAVAILABLE"
  | "VOICE_PERMISSION_DENIED";

export type VoiceServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: VoiceServiceErrorCode; message: string } }>;

export type VoiceStateListener = (snapshot: VoiceServiceSnapshot) => void;

let room: Room | null = null;
let snapshot: VoiceServiceSnapshot = {
  status: "idle",
  roomName: null,
  muted: false,
  deafened: false,
  participants: [],
  error: null,
};

const listeners = new Set<VoiceStateListener>();

function emit(next: Partial<VoiceServiceSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
}

function voiceError(code: VoiceServiceErrorCode, message: string): VoiceServiceResult<never> {
  const status: VoiceConnectionStatus = code === "VOICE_PERMISSION_DENIED" ? "permission_denied" : "token_error";

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
  };
}

function getParticipants(activeRoom: Room): VoiceParticipant[] {
  const remoteParticipants = Array.from(activeRoom.remoteParticipants.values()).map(mapParticipant);

  return [
    {
      identity: activeRoom.localParticipant.identity,
      name: activeRoom.localParticipant.name || activeRoom.localParticipant.identity,
      isLocal: true,
    },
    ...remoteParticipants,
  ];
}

function bindRoomEvents(activeRoom: Room): void {
  activeRoom
    .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Connected) {
        emit({ status: "connected", participants: getParticipants(activeRoom), error: null });
        return;
      }

      if (state === ConnectionState.Reconnecting) {
        emit({ status: "reconnecting" });
        return;
      }

      if (state === ConnectionState.Disconnected) {
        emit({ status: "disconnected" });
      }
    })
    .on(RoomEvent.ParticipantConnected, () => {
      emit({ participants: getParticipants(activeRoom) });
    })
    .on(RoomEvent.ParticipantDisconnected, () => {
      emit({ participants: getParticipants(activeRoom) });
    })
    .on(RoomEvent.Disconnected, () => {
      emit({ status: "disconnected", participants: [], roomName: null });
    });
}

function stopLocalTracks(activeRoom: Room): void {
  activeRoom.localParticipant.trackPublications.forEach((publication) => {
    publication.track?.stop();
  });
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

    emit({
      status: "disconnected",
      roomName: null,
      participants: [],
      muted: false,
      deafened: false,
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

    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        publication.setSubscribed(!deafened);
      });
    });

    emit({ deafened });
    return { ok: true, data: snapshot };
  },
};
