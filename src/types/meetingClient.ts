import type { MeetingCapabilities, MeetingConnectionQuality, MeetingLayoutMode, MeetingReactionKind, MeetingRole, MeetingSidePanel } from "./meeting";
import type { MeetingRequestedSources } from "../services/livekit/meetingTokenTypes";
import type { VerificationSummary } from "./verification";
import type { MeetingHandQueueEntry } from "./meetingSignals";

export type MeetingClientPhase =
  | "idle"
  | "prejoin"
  | "waiting"
  | "token-loading"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "ended"
  | "failed";

export type MeetingClientErrorCode =
  | "MEETING_CONTEXT_INVALID"
  | "MEETING_JOIN_IN_PROGRESS"
  | "MEETING_TOKEN_UNAVAILABLE"
  | "MEETING_WAITING"
  | "MEETING_ADMISSION_DENIED"
  | "MEETING_PERMISSION_DENIED"
  | "MEETING_CONNECTION_FAILED"
  | "MEETING_RECONNECT_FAILED"
  | "MEETING_ENDED"
  | "MEETING_PROVIDER_ERROR"
  | "MEETING_STALE_OPERATION";

export type MeetingClientError = Readonly<{
  code: MeetingClientErrorCode;
  message: string;
  recoverable: boolean;
  providerCode?: string;
}>;

export type MeetingClientContext = Readonly<{
  roomId: string;
  sessionId: string;
  communityId: string;
  communityName?: string;
  channelId: string;
  channelName?: string;
  roomTitle: string;
  roomMode?: "voice" | "meeting" | "stage";
}>;

export type MeetingClientJoinRequest = MeetingClientContext & Readonly<{
  requestedSources: MeetingRequestedSources;
  participantName?: string;
  mockDisposition?: "authorized" | "waiting" | "failed";
  mockRole?: MeetingRole;
  joinMuted?: boolean;
  joinCameraOff?: boolean;
  cameraDeviceId?: string;
  noiseShield?: boolean;
}>;

export type MeetingClientParticipant = Readonly<{
  id: string;
  userId?: string;
  identity: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  role: MeetingRole;
  communityRole?: Readonly<{ id: string; name: string }> | null;
  verification?: VerificationSummary;
  presence: "invited" | "waiting" | "joining" | "connected" | "reconnecting" | "left" | "removed";
  isLocal: boolean;
  isSpeaking: boolean;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  cameraStream?: MediaStream;
  screenSharing: boolean;
  screenShareAllowed?: boolean;
  handRaised: boolean;
  connectionQuality: MeetingConnectionQuality;
}>;

export type MeetingClientReaction = Readonly<{
  id: string;
  senderIdentity: string;
  kind: MeetingReactionKind;
  createdAt: string;
  expiresAt: string;
}>;

export type MeetingClientScreenShare = Readonly<{
  id: string;
  participantIdentity: string;
  participantName: string;
  isLocal: boolean;
  stream: MediaStream;
  sourceLabel?: string;
}>;

export type MeetingClientSnapshot = Readonly<{
  schemaVersion: 1;
  generation: number;
  phase: MeetingClientPhase;
  context: MeetingClientContext | null;
  role: MeetingRole | null;
  capabilities: MeetingCapabilities;
  participantIds: readonly string[];
  participantsById: Readonly<Record<string, MeetingClientParticipant>>;
  waitingEntry: Readonly<{ id: string; status: "waiting" | "admitted" | "denied" | "expired" | "cancelled" }> | null;
  layout: MeetingLayoutMode;
  rightDock: MeetingSidePanel;
  focusedParticipantId: string | null;
  focusedShareId: string | null;
  screenShares?: readonly MeetingClientScreenShare[];
  localDevices: Readonly<{
    inputId: string;
    outputId: string;
    permission: "prompt" | "granted" | "denied" | "unsupported";
  }>;
  localMedia: Readonly<{ muted: boolean; deafened: boolean; cameraEnabled: boolean; screenSharing: boolean }>;
  noiseShield: Readonly<{ requested: boolean; applied: boolean; status: "off" | "requested" | "applied" | "unavailable" | "failed" }>;
  handRaised: boolean;
  stageQueue?: readonly MeetingHandQueueEntry[];
  reactions: readonly MeetingClientReaction[];
  providerStatus: string;
  realtimeStatus: "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
  error: MeetingClientError | null;
  updatedAt: string;
}>;

export type MeetingClientResult<T> = Readonly<{ ok: true; data: T } | { ok: false; error: MeetingClientError }>;
