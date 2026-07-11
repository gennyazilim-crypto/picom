import type { MeetingRole } from "../../types/meeting";

export type MeetingRequestedSources = Readonly<{
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
  data: boolean;
}>;

export type MeetingTokenRequest = Readonly<{
  roomId: string;
  sessionId: string;
  requestedSources: MeetingRequestedSources;
}>;

export type MeetingTokenAuthorizedResponse = Readonly<{
  state: "authorized";
  token: string;
  url: string;
  roomId: string;
  sessionId: string;
  communityId: string;
  roomName: string;
  identity: string;
  participantName: string;
  role: MeetingRole;
  canSubscribe: boolean;
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canPublishScreen: boolean;
  canPublishData: boolean;
  expiresAt: string;
}>;

export type MeetingTokenWaitingResponse = Readonly<{
  state: "waiting";
  roomId: string;
  sessionId: string;
  communityId: string;
  role: MeetingRole;
  waitingEntryId: string;
  canSubscribe: true;
}>;

export type MeetingTokenResponse = MeetingTokenAuthorizedResponse | MeetingTokenWaitingResponse;
export type MeetingTokenResult = Readonly<{ ok: true; data: MeetingTokenResponse } | { ok: false; error: { code: "MEETING_NOT_CONFIGURED" | "MEETING_TOKEN_FAILED" | "MEETING_TOKEN_INVALID_RESPONSE"; message: string } }>;
