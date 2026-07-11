import type {
  MeetingParticipantAuthority,
  MeetingParticipantLiveKitOverlay,
  MeetingParticipantStateSnapshot,
  ReconciledMeetingParticipant,
  ReconciledMeetingParticipantSnapshot,
} from "../types/meetingParticipantState";

const ACTIVE_STATES = new Set(["joining", "connected", "reconnecting"]);
const EMPTY_SNAPSHOT: MeetingParticipantStateSnapshot = { schemaVersion: 1, roomId: "", sessionId: "", sessionSequence: 0, generatedAt: new Date(0).toISOString(), participants: [] };

function eventTime(participant: MeetingParticipantAuthority): number {
  return Date.parse(participant.lastProviderEventAt ?? participant.lastSeenAt ?? participant.joinedAt ?? "1970-01-01T00:00:00.000Z") || 0;
}

function preferredParticipant(left: MeetingParticipantAuthority, right: MeetingParticipantAuthority): MeetingParticipantAuthority {
  const leftActive = ACTIVE_STATES.has(left.providerPresence), rightActive = ACTIVE_STATES.has(right.providerPresence);
  if (leftActive !== rightActive) return rightActive ? right : left;
  if (left.connectionGeneration !== right.connectionGeneration) return right.connectionGeneration > left.connectionGeneration ? right : left;
  return eventTime(right) >= eventTime(left) ? right : left;
}

function dedupeParticipants(participants: readonly MeetingParticipantAuthority[]): MeetingParticipantAuthority[] {
  const byIdentity = new Map<string, MeetingParticipantAuthority>();
  for (const participant of participants) {
    const identityKey = participant.userId ? `user:${participant.userId}` : `provider:${participant.providerIdentity}`;
    const current = byIdentity.get(identityKey);
    byIdentity.set(identityKey, current ? preferredParticipant(current, participant) : participant);
  }
  return [...byIdentity.values()].sort((left, right) => Number(!ACTIVE_STATES.has(left.providerPresence))-Number(!ACTIVE_STATES.has(right.providerPresence)) || eventTime(left)-eventTime(right));
}

export type MeetingParticipantStore = Readonly<{
  replaceAuthoritative: (snapshot: MeetingParticipantStateSnapshot) => boolean;
  applyLiveKitOverlay: (overlay: MeetingParticipantLiveKitOverlay) => boolean;
  removeLiveKitOverlay: (providerIdentity: string) => void;
  pruneStaleOverlays: (olderThanMs?: number, now?: number) => void;
  reset: () => void;
  getSnapshot: () => ReconciledMeetingParticipantSnapshot;
}>;

export function createMeetingParticipantStore(initial: MeetingParticipantStateSnapshot = EMPTY_SNAPSHOT): MeetingParticipantStore {
  let authoritative: MeetingParticipantStateSnapshot = { ...initial, participants: dedupeParticipants(initial.participants) };
  const overlays = new Map<string, MeetingParticipantLiveKitOverlay>();

  const replaceAuthoritative = (snapshot: MeetingParticipantStateSnapshot): boolean => {
    const sameSession = authoritative.sessionId && authoritative.sessionId === snapshot.sessionId;
    if (sameSession && snapshot.sessionSequence < authoritative.sessionSequence) return false;
    if (sameSession && snapshot.sessionSequence === authoritative.sessionSequence && Date.parse(snapshot.generatedAt) < Date.parse(authoritative.generatedAt)) return false;
    const participants = dedupeParticipants(snapshot.participants);
    const activeIdentities = new Set(participants.map((participant) => participant.providerIdentity));
    for (const identity of overlays.keys()) if (!activeIdentities.has(identity)) overlays.delete(identity);
    authoritative = { ...snapshot, participants };
    return true;
  };

  const applyLiveKitOverlay = (overlay: MeetingParticipantLiveKitOverlay): boolean => {
    const current = overlays.get(overlay.providerIdentity);
    if (current && ((overlay.sequence ?? 0) < (current.sequence ?? 0) || ((overlay.sequence ?? 0) === (current.sequence ?? 0) && Date.parse(overlay.observedAt) < Date.parse(current.observedAt)))) return false;
    overlays.set(overlay.providerIdentity, overlay);
    return true;
  };

  const getSnapshot = (): ReconciledMeetingParticipantSnapshot => ({
    ...authoritative,
    participants: authoritative.participants.map((participant): ReconciledMeetingParticipant => {
      const overlay = overlays.get(participant.providerIdentity);
      return {
        ...participant,
        isSpeaking: overlay?.isSpeaking ?? false,
        connectionQuality: overlay?.connectionQuality ?? "unknown",
        liveMicrophonePublished: overlay?.microphonePublished ?? participant.tracks.some((track) => track.state === "published" && track.source === "microphone"),
        liveCameraPublished: overlay?.cameraPublished ?? participant.tracks.some((track) => track.state === "published" && track.source === "camera"),
        liveScreenSharePublished: overlay?.screenSharePublished ?? participant.tracks.some((track) => track.state === "published" && track.source === "screen_share"),
      };
    }),
  });

  return {
    replaceAuthoritative,
    applyLiveKitOverlay,
    removeLiveKitOverlay: (providerIdentity) => { overlays.delete(providerIdentity); },
    pruneStaleOverlays: (olderThanMs = 30_000, now = Date.now()) => { for (const [identity, overlay] of overlays) if (now-Date.parse(overlay.observedAt)>olderThanMs) overlays.delete(identity); },
    reset: () => { authoritative = EMPTY_SNAPSHOT; overlays.clear(); },
    getSnapshot,
  };
}
