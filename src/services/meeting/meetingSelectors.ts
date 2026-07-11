import type { MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingCapabilities } from "../../types/meeting";

export const meetingSelectors = {
  phase: (snapshot: MeetingClientSnapshot) => snapshot.phase,
  isActive: (snapshot: MeetingClientSnapshot) => ["token-loading", "connecting", "connected", "reconnecting"].includes(snapshot.phase),
  isConnected: (snapshot: MeetingClientSnapshot) => snapshot.phase === "connected" || snapshot.phase === "reconnecting",
  participants: (snapshot: MeetingClientSnapshot) => snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean),
  localParticipant: (snapshot: MeetingClientSnapshot) => snapshot.participantIds.map((id) => snapshot.participantsById[id]).find((participant) => participant?.isLocal) ?? null,
  screenSharers: (snapshot: MeetingClientSnapshot) => snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter((participant) => participant?.screenSharing),
  can: <K extends keyof MeetingCapabilities>(snapshot: MeetingClientSnapshot, capability: K) => snapshot.capabilities[capability],
  errorMessage: (snapshot: MeetingClientSnapshot) => snapshot.error?.message ?? null,
};
