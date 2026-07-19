export type DmCallType = "voice" | "video";

export type DmCallStatus =
  | "ringing"
  | "active"
  | "declined"
  | "canceled"
  | "missed"
  | "busy"
  | "failed"
  | "completed";

export type DmCallInvitationStatus = "ringing" | "accepted" | "declined" | "canceled" | "missed" | "busy";

export type DmCallParticipantStatus =
  | "invited"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "left";

export type DmCallQualityLabel = "excellent" | "good" | "unstable" | "poor" | "reconnecting" | "unknown";

export type DmCallParticipant = Readonly<{
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  invitationStatus: DmCallInvitationStatus;
  joinedAt?: string;
  leftAt?: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  reconnectCount: number;
  finalStatus: DmCallParticipantStatus;
}>;

export type DmCallEvent = Readonly<{
  id: string;
  callId: string;
  actorId?: string;
  type: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DmCallInvitation = Readonly<{
  id: string;
  inviterId: string;
  inviteeId: string;
  status: DmCallInvitationStatus;
  expiresAt: string;
  respondedAt?: string;
  readAt?: string;
}>;

export type DmCall = Readonly<{
  id: string;
  conversationId: string;
  livekitRoomName: string;
  createdBy: string;
  callType: DmCallType;
  status: DmCallStatus;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  screenShareUsed: boolean;
  recordingStatus: "disabled" | "pending" | "active" | "stopped" | "failed";
  createdAt: string;
  updatedAt: string;
  participants: readonly DmCallParticipant[];
  events: readonly DmCallEvent[];
  invitation?: DmCallInvitation;
  unread: boolean;
}>;

export type DmCallQualitySample = Readonly<{
  pingMs?: number;
  jitterMs?: number;
  packetLossPercent?: number;
  uploadBitrateKbps?: number;
  downloadBitrateKbps?: number;
  audioCodec?: string;
  videoCodec?: string;
  connectionType?: string;
  livekitRegion?: string;
  reconnectCount: number;
  quality: DmCallQualityLabel;
}>;

export type DmCallRuntimeState = Readonly<{
  connected: boolean;
  reconnecting: boolean;
  muted: boolean;
  deafened: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  participantCount: number;
  activeSpeakerName?: string;
  quality: DmCallQualityLabel;
  reconnectCount: number;
}>;
