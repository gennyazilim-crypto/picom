export type LiveKitIntent = "voice" | "video" | "screen";

export type LiveKitTokenRequest = Readonly<{
  communityId: string;
  channelId: string;
  roomName?: string;
  participantName?: string;
  intent?: LiveKitIntent;
}>;

export type LiveKitTokenResponse = Readonly<{
  token: string;
  url: string;
  roomName: string;
  identity: string;
  participantName: string;
  intent: LiveKitIntent;
  canPublishAudio: boolean;
  canPublishVideo?: boolean;
  canPublishScreen: boolean;
  expiresAt: string;
}>;

export type LiveKitServiceErrorCode =
  | "LIVEKIT_NOT_CONFIGURED"
  | "LIVEKIT_TOKEN_FAILED"
  | "LIVEKIT_INVALID_TOKEN_RESPONSE";

export type LiveKitServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: LiveKitServiceErrorCode; message: string } }>;
