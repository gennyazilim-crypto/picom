import { getMeetingCapabilities } from "../services/meeting/meetingCapabilityService";
import type {
  MeetingClientStoreSnapshot,
  MeetingEvent,
  MeetingFixtureMode,
  MeetingLayout,
  MeetingParticipant,
  MeetingRoom,
  MeetingSession,
  WaitingRoomEntry,
} from "../types/meeting";

const createdAt = "2026-07-11T09:00:00.000Z";
const startedAt = "2026-07-11T09:05:00.000Z";
const updatedAt = "2026-07-11T09:10:00.000Z";

const room = (overrides: Partial<MeetingRoom> = {}): MeetingRoom => ({
  id: "meeting-room-design-sync",
  title: "Design sync",
  description: "Deterministic meeting fixture",
  source: { kind: "community_channel", communityId: "community-aurora", channelId: "channel-meeting-room" },
  status: "live",
  joinPolicy: "members",
  waitingRoomEnabled: false,
  maxParticipants: 50,
  defaultRole: "participant",
  createdByUserId: "user-owner",
  createdAt,
  updatedAt,
  ...overrides,
});

const session = (overrides: Partial<MeetingSession> = {}): MeetingSession => ({
  id: "meeting-session-design-sync",
  roomId: "meeting-room-design-sync",
  provider: "livekit",
  providerRoomName: "picom-community-aurora-channel-meeting-room",
  status: "live",
  connectionState: "connected",
  startedByUserId: "user-owner",
  startedAt,
  participantCount: 3,
  lastEventSequence: 4,
  ...overrides,
});

const participant = (overrides: Partial<MeetingParticipant> = {}): MeetingParticipant => ({
  id: "participant-owner",
  sessionId: "meeting-session-design-sync",
  userId: "user-owner",
  identity: "user-owner",
  name: "Ada Stone",
  role: "host",
  presence: "connected",
  isLocal: true,
  isSpeaking: false,
  isMicrophoneEnabled: true,
  isCameraEnabled: false,
  isScreenSharing: false,
  isHandRaised: false,
  connectionQuality: "excellent",
  joinedAt: startedAt,
  tracks: [],
  ...overrides,
});

const layout = (overrides: Partial<MeetingLayout> = {}): MeetingLayout => ({
  mode: "grid",
  sidePanel: "none",
  pinnedParticipantIds: [],
  filmstripVisible: false,
  compactTiles: false,
  ...overrides,
});

const event = (overrides: Partial<MeetingEvent> = {}): MeetingEvent => ({
  id: "meeting-event-1",
  roomId: "meeting-room-design-sync",
  sessionId: "meeting-session-design-sync",
  sequence: 1,
  occurredAt: startedAt,
  type: "session_started",
  payload: { providerRoomName: "picom-community-aurora-channel-meeting-room" },
  ...overrides,
} as MeetingEvent);

export type MockMeetingFixture = Readonly<{
  room: MeetingRoom;
  session: MeetingSession | null;
  participants: readonly MeetingParticipant[];
  waitingRoom: readonly WaitingRoomEntry[];
  events: readonly MeetingEvent[];
  store: MeetingClientStoreSnapshot;
}>;

const fixture = (
  fixtureRoom: MeetingRoom,
  fixtureSession: MeetingSession | null,
  participants: readonly MeetingParticipant[],
  fixtureLayout: MeetingLayout,
  waitingRoom: readonly WaitingRoomEntry[] = [],
  events: readonly MeetingEvent[] = [],
  errorCode: string | null = null,
): MockMeetingFixture => ({
  room: fixtureRoom,
  session: fixtureSession,
  participants,
  waitingRoom,
  events,
  store: {
    schemaVersion: 1,
    room: fixtureRoom,
    session: fixtureSession,
    localParticipantId: participants.find((item) => item.isLocal)?.id ?? null,
    connectionState: fixtureSession?.connectionState ?? "idle",
    localCapabilities: getMeetingCapabilities(participants.find((item) => item.isLocal)?.role ?? "guest"),
    participants,
    waitingRoom,
    reactions: [],
    raisedHands: participants.filter((item) => item.isHandRaised).map((item, index) => ({
      participantId: item.id,
      raised: true,
      raisedAt: updatedAt,
      order: index + 1,
    })),
    layout: fixtureLayout,
    lastAppliedEventSequence: fixtureSession?.lastEventSequence ?? 0,
    errorCode,
  },
});

const host = participant();
const speaker = participant({
  id: "participant-speaker",
  userId: "user-speaker",
  identity: "user-speaker",
  name: "Mika Chen",
  role: "speaker",
  isLocal: false,
  isSpeaking: true,
  isCameraEnabled: true,
  connectionQuality: "good",
});
const viewer = participant({
  id: "participant-viewer",
  userId: "user-viewer",
  identity: "user-viewer",
  name: "Noor Kaya",
  role: "viewer",
  isLocal: false,
  isMicrophoneEnabled: false,
  connectionQuality: "good",
});

export const mockMeetingFixtures = Object.freeze({
  voice: fixture(
    room({ title: "Community voice lounge" }),
    session({ participantCount: 2 }),
    [host, speaker],
    layout({ mode: "speaker", focusedParticipantId: speaker.id, filmstripVisible: true }),
    [],
    [event()],
  ),
  meeting: fixture(
    room(),
    session(),
    [host, speaker, viewer],
    layout(),
    [],
    [event()],
  ),
  stage: fixture(
    room({ title: "Community town hall", joinPolicy: "approval_required", defaultRole: "viewer", maxParticipants: 500 }),
    session({ participantCount: 38 }),
    [host, speaker, viewer],
    layout({ mode: "stage", focusedParticipantId: speaker.id, filmstripVisible: true }),
    [],
    [event({ id: "meeting-event-stage", sequence: 2, type: "participant_role_changed", payload: { participantId: speaker.id, from: "participant", to: "speaker" } } as Partial<MeetingEvent>)],
  ),
  camera_off: fixture(
    room({ title: "Camera-off planning" }),
    session({ participantCount: 2 }),
    [host, speaker].map((item) => ({ ...item, isCameraEnabled: false })),
    layout({ mode: "grid" }),
  ),
  screen_share: fixture(
    room({ title: "Product walkthrough" }),
    session({ participantCount: 3, activeScreenShareParticipantId: speaker.id }),
    [host, { ...speaker, isScreenSharing: true }, viewer],
    layout({ mode: "screen_share", focusedParticipantId: speaker.id, focusedTrackId: "track-screen-speaker", filmstripVisible: true }),
    [],
    [event({ id: "meeting-event-screen", sequence: 3, type: "layout_hint", payload: { mode: "screen_share", participantId: speaker.id } } as Partial<MeetingEvent>)],
  ),
  waiting_room: fixture(
    room({ title: "Private review", joinPolicy: "approval_required", waitingRoomEnabled: true, status: "open" }),
    session({ status: "preparing", connectionState: "waiting_room", participantCount: 1 }),
    [host],
    layout({ sidePanel: "people" }),
    [{
      id: "waiting-entry-guest",
      roomId: "meeting-room-design-sync",
      sessionId: "meeting-session-design-sync",
      userId: "user-guest",
      displayName: "Rin Guest",
      requestedRole: "guest",
      status: "waiting",
      requestedAt: updatedAt,
    }],
    [event({ id: "meeting-event-waiting", sequence: 4, type: "waiting_room_changed", payload: { entryId: "waiting-entry-guest", status: "waiting" } } as Partial<MeetingEvent>)],
  ),
  failure: fixture(
    room({ title: "Unavailable meeting", status: "open" }),
    session({ status: "failed", connectionState: "error", participantCount: 0 }),
    [],
    layout(),
    [],
    [event({ id: "meeting-event-failure", sequence: 5, type: "session_ended", payload: { reason: "error" } } as Partial<MeetingEvent>)],
    "MEETING_CONNECTION_FAILED",
  ),
}) satisfies Readonly<Record<MeetingFixtureMode, MockMeetingFixture>>;

export const mockMeetingFixtureModes = Object.freeze(Object.keys(mockMeetingFixtures) as MeetingFixtureMode[]);
