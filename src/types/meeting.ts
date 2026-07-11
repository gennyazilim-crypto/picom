import type { CommunityMembershipStatus, CommunityPermissionKey } from "./communityAccess";

export type MeetingRoomId = string;
export type MeetingSessionId = string;
export type MeetingParticipantId = string;
export type MeetingInviteId = string;

export type MeetingRole = "host" | "cohost" | "speaker" | "participant" | "viewer" | "guest";
export type MeetingRoomStatus = "scheduled" | "open" | "live" | "ended" | "cancelled" | "locked";
export type MeetingSessionStatus = "preparing" | "live" | "reconnecting" | "ended" | "failed";
export type MeetingJoinPolicy = "open" | "members" | "invite_only" | "approval_required";
export type MeetingProvider = "livekit";

export type MeetingRoomSource =
  | Readonly<{ kind: "community_channel"; communityId: string; channelId: string }>
  | Readonly<{ kind: "scheduled_event"; communityId: string; eventId: string; channelId?: string }>
  | Readonly<{ kind: "ad_hoc"; createdByUserId: string; approvedByUserId: string; communityId?: string }>;

export type MeetingRoomContext = Readonly<{
  communityId: string;
  communityName?: string;
  channelId: string;
  channelName?: string;
  eventId?: string;
}>;

export type MeetingCapabilities = Readonly<{
  canJoin: boolean;
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canShareScreen: boolean;
  canSendChat: boolean;
  canReact: boolean;
  canRaiseHand: boolean;
  canInvite: boolean;
  canAdmit: boolean;
  canManageParticipants: boolean;
  canManageRoles: boolean;
  canLockRoom: boolean;
  canEndRoom: boolean;
  canStartCaptions: boolean;
  canViewAttendance: boolean;
}>;

export type MeetingRoleMapping = Readonly<{
  meetingRole: MeetingRole;
  communityStatus: CommunityMembershipStatus;
  requiredPermissions: readonly CommunityPermissionKey[];
}>;

export type MeetingTransportConnectionState =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "permission_denied"
  | "token_error"
  | "error"
  | "disconnected";

export type MeetingConnectionState =
  | MeetingTransportConnectionState
  | "waiting_room"
  | "admitted"
  | "ending";

export type MeetingTrackKind = "audio" | "video";
export type MeetingTrackSource = "microphone" | "camera" | "screen_share" | "screen_share_audio";
export type MeetingTrackLifecycle = "pending" | "active" | "muted" | "paused" | "ended" | "failed";
export type MeetingTrackQuality = "low" | "medium" | "high" | "source";

export type MeetingTrackState = Readonly<{
  id: string;
  participantId: MeetingParticipantId;
  kind: MeetingTrackKind;
  source: MeetingTrackSource;
  lifecycle: MeetingTrackLifecycle;
  enabled: boolean;
  subscribed: boolean;
  local: boolean;
  quality?: MeetingTrackQuality;
  publicationId?: string;
  updatedAt: string;
}>;

export type MeetingParticipantPresence = "invited" | "waiting" | "joining" | "connected" | "reconnecting" | "left" | "removed";
export type MeetingConnectionQuality = "excellent" | "good" | "poor" | "unknown";

export type MeetingParticipant = Readonly<{
  id: MeetingParticipantId;
  sessionId: MeetingSessionId;
  userId?: string;
  identity: string;
  name: string;
  role: MeetingRole;
  presence: MeetingParticipantPresence;
  isLocal: boolean;
  isSpeaking: boolean;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  connectionQuality: MeetingConnectionQuality;
  joinedAt?: string;
  leftAt?: string;
  tracks: readonly MeetingTrackState[];
}>;

export type MeetingRoom = Readonly<{
  id: MeetingRoomId;
  title: string;
  description?: string;
  source: MeetingRoomSource;
  status: MeetingRoomStatus;
  joinPolicy: MeetingJoinPolicy;
  waitingRoomEnabled: boolean;
  maxParticipants: number;
  defaultRole: MeetingRole;
  capabilityOverrides?: Readonly<Partial<MeetingCapabilities>>;
  scheduledFor?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}>;

export type MeetingSession = Readonly<{
  id: MeetingSessionId;
  roomId: MeetingRoomId;
  provider: MeetingProvider;
  providerRoomName: string;
  status: MeetingSessionStatus;
  connectionState: MeetingConnectionState;
  startedByUserId: string;
  startedAt?: string;
  endedAt?: string;
  endedByUserId?: string;
  participantCount: number;
  activeScreenShareParticipantId?: MeetingParticipantId;
  lastEventSequence: number;
}>;

export type WaitingRoomEntryStatus = "waiting" | "admitted" | "denied" | "expired" | "cancelled";

export type WaitingRoomEntry = Readonly<{
  id: string;
  roomId: MeetingRoomId;
  sessionId?: MeetingSessionId;
  userId: string;
  displayName: string;
  requestedRole: MeetingRole;
  status: WaitingRoomEntryStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  denialReasonCode?: "room_locked" | "not_invited" | "capacity" | "host_denied" | "policy";
}>;

export type MeetingInviteStatus = "active" | "accepted" | "declined" | "revoked" | "expired";

export type MeetingInvite = Readonly<{
  id: MeetingInviteId;
  roomId: MeetingRoomId;
  invitedUserId?: string;
  invitedByUserId: string;
  role: MeetingRole;
  status: MeetingInviteStatus;
  tokenHint?: string;
  createdAt: string;
  expiresAt?: string;
  respondedAt?: string;
}>;

export type MeetingReactionKind = "thumbs_up" | "heart" | "celebrate" | "laugh" | "surprised" | "clap";

export type MeetingReaction = Readonly<{
  id: string;
  sessionId: MeetingSessionId;
  participantId: MeetingParticipantId;
  kind: MeetingReactionKind;
  createdAt: string;
  expiresAt: string;
}>;

export type RaisedHandState = Readonly<{
  participantId: MeetingParticipantId;
  raised: boolean;
  raisedAt?: string;
  order?: number;
  loweredAt?: string;
  loweredByParticipantId?: MeetingParticipantId;
}>;

export type MeetingLayoutMode = "grid" | "speaker" | "screen_share" | "stage";
export type MeetingSidePanel = "none" | "people" | "chat" | "captions" | "info";

export type MeetingLayout = Readonly<{
  mode: MeetingLayoutMode;
  sidePanel: MeetingSidePanel;
  pinnedParticipantIds: readonly MeetingParticipantId[];
  focusedParticipantId?: MeetingParticipantId;
  focusedTrackId?: string;
  filmstripVisible: boolean;
  compactTiles: boolean;
}>;

type MeetingEventBase = Readonly<{
  id: string;
  roomId: MeetingRoomId;
  sessionId?: MeetingSessionId;
  sequence: number;
  occurredAt: string;
  actorParticipantId?: MeetingParticipantId;
}>;

export type MeetingEvent = MeetingEventBase & (
  | Readonly<{ type: "room_status_changed"; payload: { from: MeetingRoomStatus; to: MeetingRoomStatus } }>
  | Readonly<{ type: "session_started"; payload: { providerRoomName: string } }>
  | Readonly<{ type: "session_ended"; payload: { reason: "host" | "empty" | "timeout" | "provider" | "error" } }>
  | Readonly<{ type: "participant_joined"; payload: { participantId: MeetingParticipantId; role: MeetingRole } }>
  | Readonly<{ type: "participant_left"; payload: { participantId: MeetingParticipantId; reason: "left" | "removed" | "disconnected" } }>
  | Readonly<{ type: "participant_role_changed"; payload: { participantId: MeetingParticipantId; from: MeetingRole; to: MeetingRole } }>
  | Readonly<{ type: "track_changed"; payload: { participantId: MeetingParticipantId; track: MeetingTrackState } }>
  | Readonly<{ type: "waiting_room_changed"; payload: { entryId: string; status: WaitingRoomEntryStatus } }>
  | Readonly<{ type: "reaction"; payload: { reaction: MeetingReaction } }>
  | Readonly<{ type: "raised_hand_changed"; payload: { state: RaisedHandState } }>
  | Readonly<{ type: "layout_hint"; payload: { mode: MeetingLayoutMode; participantId?: MeetingParticipantId } }>
  | Readonly<{ type: "caption_state_changed"; payload: { enabled: boolean; language?: string } }>
  | Readonly<{ type: "connection_changed"; payload: { participantId: MeetingParticipantId; state: MeetingConnectionState } }>
);

export type MeetingBackendSnapshot = Readonly<{
  schemaVersion: 1;
  room: MeetingRoom;
  session: MeetingSession | null;
  participants: readonly MeetingParticipant[];
  waitingRoom: readonly WaitingRoomEntry[];
  invites: readonly MeetingInvite[];
  raisedHands: readonly RaisedHandState[];
  lastEventSequence: number;
  generatedAt: string;
}>;

export type MeetingProviderEvent =
  | Readonly<{
      provider: "livekit";
      type: "participant";
      providerEventId: string;
      providerRoomName: string;
      identity: string;
      connected: boolean;
      occurredAt: string;
    }>
  | Readonly<{
      provider: "livekit";
      type: "track";
      providerEventId: string;
      providerRoomName: string;
      identity: string;
      source: MeetingTrackSource;
      lifecycle: MeetingTrackLifecycle;
      occurredAt: string;
    }>
  | Readonly<{
      provider: "livekit";
      type: "room";
      providerEventId: string;
      providerRoomName: string;
      active: boolean;
      occurredAt: string;
    }>;

export type MeetingClientStoreSnapshot = Readonly<{
  schemaVersion: 1;
  room: MeetingRoom | null;
  session: MeetingSession | null;
  localParticipantId: MeetingParticipantId | null;
  connectionState: MeetingConnectionState;
  localCapabilities: MeetingCapabilities;
  participants: readonly MeetingParticipant[];
  waitingRoom: readonly WaitingRoomEntry[];
  reactions: readonly MeetingReaction[];
  raisedHands: readonly RaisedHandState[];
  layout: MeetingLayout;
  lastAppliedEventSequence: number;
  errorCode: string | null;
}>;

export type SerializedMeetingEventEnvelope = Readonly<{
  schemaVersion: 1;
  source: "backend" | "livekit_projection";
  event: MeetingEvent;
}>;

export type MeetingFixtureMode = "voice" | "meeting" | "stage" | "camera_off" | "screen_share" | "waiting_room" | "failure";

export const MEETING_SERIALIZATION_VERSION = 1 as const;
