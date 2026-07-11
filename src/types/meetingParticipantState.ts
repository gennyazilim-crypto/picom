import type { MeetingConnectionQuality, MeetingParticipantPresence, MeetingRole } from "./meeting";
import type { VerificationSummary } from "./verification";

export type MeetingClientPresenceStatus = "online" | "idle" | "dnd" | "offline" | "unknown";
export type MeetingParticipantTrackSource = "microphone" | "camera" | "screen_share" | "screen_share_audio" | "unknown";

export type MeetingParticipantAuthoritativeTrack = Readonly<{
  id: string;
  providerTrackSid: string;
  kind: "audio" | "video";
  source: MeetingParticipantTrackSource;
  state: "published" | "unpublished";
  publishedAt: string;
  unpublishedAt: string | null;
  lastProviderEventAt: string | null;
}>;

export type MeetingParticipantAuthority = Readonly<{
  participantId: string;
  sessionId: string;
  userId: string | null;
  providerIdentity: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  meetingRole: MeetingRole;
  communityRole: Readonly<{ id: string; name: string }> | null;
  verification: VerificationSummary;
  clientPresence: Readonly<{ status: MeetingClientPresenceStatus; shared: boolean }>;
  providerPresence: MeetingParticipantPresence;
  capabilities: Readonly<Record<string, unknown>>;
  connectionGeneration: number;
  joinedAt: string | null;
  leftAt: string | null;
  lastSeenAt: string | null;
  lastProviderEventAt: string | null;
  lastProviderEventId: string | null;
  handState: Readonly<{ raised: boolean; raisedAt: string | null; sequence: number; serverVersion: number }>;
  attendance: Readonly<{ joinedAt: string; leftAt: string | null; durationSeconds: number | null; reconnectCount: number; finalState: "left" | "removed" | "disconnected" | "ended" }> | null;
  tracks: readonly MeetingParticipantAuthoritativeTrack[];
}>;

export type MeetingParticipantLiveKitOverlay = Readonly<{
  providerIdentity: string;
  observedAt: string;
  sequence?: number;
  isSpeaking: boolean;
  connectionQuality: MeetingConnectionQuality;
  microphonePublished: boolean;
  cameraPublished: boolean;
  screenSharePublished: boolean;
}>;

export type ReconciledMeetingParticipant = MeetingParticipantAuthority & Readonly<{
  isSpeaking: boolean;
  connectionQuality: MeetingConnectionQuality;
  liveMicrophonePublished: boolean;
  liveCameraPublished: boolean;
  liveScreenSharePublished: boolean;
}>;

export type MeetingParticipantStateSnapshot = Readonly<{
  schemaVersion: 1;
  roomId: string;
  sessionId: string;
  sessionSequence: number;
  generatedAt: string;
  participants: readonly MeetingParticipantAuthority[];
}>;

export type ReconciledMeetingParticipantSnapshot = Omit<MeetingParticipantStateSnapshot, "participants"> & Readonly<{
  participants: readonly ReconciledMeetingParticipant[];
}>;
