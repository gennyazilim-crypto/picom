import type { MeetingConnectionState, MeetingFixtureMode } from "./meeting";

export type MockVoiceState = Readonly<{
  isInVoiceRoom: boolean;
  roomName: string;
  communityName: string;
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing?: boolean;
  connectionState?: MeetingConnectionState;
  fixtureMode?: MeetingFixtureMode;
}>;

export type {
  MeetingCapabilities,
  MeetingConnectionState,
  MeetingEvent,
  MeetingInvite,
  MeetingLayout,
  MeetingParticipant,
  MeetingReaction,
  MeetingRole,
  MeetingRoom,
  MeetingRoomSource,
  MeetingSession,
  MeetingTrackState,
  RaisedHandState,
  WaitingRoomEntry,
} from "./meeting";
