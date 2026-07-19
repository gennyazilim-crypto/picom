import {
  AudioPresets,
  ConnectionState,
  DefaultReconnectPolicy,
  DisconnectReason,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

export const liveKitRuntime = {
  AudioPresets,
  ConnectionState,
  DefaultReconnectPolicy,
  DisconnectReason,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
} as const;
