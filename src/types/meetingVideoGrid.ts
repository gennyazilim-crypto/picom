import type { MeetingClientParticipant, MeetingClientSnapshot } from "./meetingClient";

export const MEETING_VIDEO_PAGE_SIZE = 12;

export type MeetingVideoGridLayout = "solo" | "duo" | "quad" | "six" | "nine" | "twelve";

export type MeetingVideoSubscriptionPlan = Readonly<{
  visibleParticipantIdentities: readonly string[];
  activeSpeakerIdentities: readonly string[];
  focusedParticipantIdentity: string | null;
  visibleTileCount: number;
}>;

export type MeetingVideoGridPlan = Readonly<{
  page: number;
  pageCount: number;
  totalParticipants: number;
  layout: MeetingVideoGridLayout;
  participants: readonly MeetingClientParticipant[];
  subscription: MeetingVideoSubscriptionPlan;
}>;

const layoutFor = (count: number): MeetingVideoGridLayout => {
  if (count <= 1) return "solo";
  if (count === 2) return "duo";
  if (count <= 4) return "quad";
  if (count <= 6) return "six";
  if (count <= 9) return "nine";
  return "twelve";
};

export function buildMeetingVideoGridPlan(snapshot: MeetingClientSnapshot, requestedPage: number): MeetingVideoGridPlan {
  const stableIndex = new Map(snapshot.participantIds.map((id, index) => [id, index]));
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  const priority = (participant: MeetingClientParticipant) => {
    if (participant.id === snapshot.focusedParticipantId) return 0;
    if (participant.isSpeaking) return 1;
    if (participant.isLocal && participant.cameraEnabled) return 2;
    if (participant.cameraEnabled) return 3;
    if (participant.isLocal) return 4;
    return 5;
  };
  const ordered = [...participants].sort((left, right) =>
    priority(left) - priority(right) || (stableIndex.get(left.id) ?? 0) - (stableIndex.get(right.id) ?? 0));
  const pageCount = Math.max(1, Math.ceil(ordered.length / MEETING_VIDEO_PAGE_SIZE));
  const page = Math.max(0, Math.min(pageCount - 1, requestedPage));
  const visible = ordered.slice(page * MEETING_VIDEO_PAGE_SIZE, (page + 1) * MEETING_VIDEO_PAGE_SIZE);
  return {
    page,
    pageCount,
    totalParticipants: ordered.length,
    layout: layoutFor(visible.length),
    participants: visible,
    subscription: {
      visibleParticipantIdentities: visible.filter((participant) => participant.cameraEnabled).map((participant) => participant.identity),
      activeSpeakerIdentities: visible.filter((participant) => participant.isSpeaking && participant.cameraEnabled).map((participant) => participant.identity),
      focusedParticipantIdentity: visible.find((participant) => participant.id === snapshot.focusedParticipantId && participant.cameraEnabled)?.identity ?? null,
      visibleTileCount: visible.length,
    },
  };
}
