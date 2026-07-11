import type { MeetingClientParticipant } from "../types/meetingClient";
import type { MeetingParticipantTileVariant } from "../components/meeting/MeetingParticipantTile";

export type MeetingParticipantTileFixture = Readonly<{ id: string; title: string; variant: MeetingParticipantTileVariant; selected?: boolean; focused?: boolean; participant: MeetingClientParticipant }>;

const base = (id: string, displayName: string): MeetingClientParticipant => ({
  id, userId: `fixture-user-${id}`, identity: `fixture-${id}`, displayName, username: displayName.toLowerCase().replace(/\s+/g, "."),
  role: "participant", communityRole: { id: "fixture-role", name: "Member" }, verification: { status: "none" }, presence: "connected", isLocal: false,
  isSpeaking: false, microphoneEnabled: true, cameraEnabled: false, screenSharing: false, handRaised: false, connectionQuality: "good",
});

export const meetingParticipantTileFixtures: readonly MeetingParticipantTileFixture[] = [
  { id: "camera", title: "Camera connecting", variant: "grid", participant: { ...base("camera", "Mira Chen"), cameraEnabled: true } },
  { id: "avatar", title: "Avatar fallback", variant: "grid", participant: { ...base("avatar", "Noah Kaya"), microphoneEnabled: false } },
  { id: "verified", title: "Approved verification", variant: "focus", participant: { ...base("verified", "Ada Stone"), role: "host", verification: { status: "approved", type: "verified_user" } } },
  { id: "speaking", title: "Restrained speaking state", variant: "stage", participant: { ...base("speaking", "Lina Park"), role: "speaker", isSpeaking: true } },
  { id: "hand", title: "Raised hand", variant: "voice", participant: { ...base("hand", "Emre Aras"), handRaised: true, role: "viewer" } },
  { id: "sharing", title: "Screen sharing", variant: "share", participant: { ...base("sharing", "Sofia Bell"), screenSharing: true } },
  { id: "poor", title: "Poor connection", variant: "filmstrip", participant: { ...base("poor", "Kai Reed"), connectionQuality: "poor", presence: "reconnecting" } },
  { id: "selected", title: "Selected and focused", variant: "voice", selected: true, focused: true, participant: { ...base("selected", "You"), isLocal: true, role: "cohost" } },
];
