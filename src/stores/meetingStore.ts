import { getMeetingCapabilities } from "../services/meeting/meetingCapabilityService";
import type { MeetingClientContext, MeetingClientError, MeetingClientParticipant, MeetingClientPhase, MeetingClientReaction, MeetingClientSnapshot } from "../types/meetingClient";
import type { MeetingCapabilities, MeetingLayoutMode, MeetingRole, MeetingSidePanel } from "../types/meeting";

const ALLOWED_TRANSITIONS: Readonly<Record<MeetingClientPhase, readonly MeetingClientPhase[]>> = Object.freeze({
  idle: ["prejoin"],
  prejoin: ["idle", "waiting", "token-loading", "failed", "ended"],
  waiting: ["prejoin", "token-loading", "failed", "ended"],
  "token-loading": ["prejoin", "waiting", "connecting", "failed", "ended"],
  connecting: ["connected", "reconnecting", "disconnected", "failed", "ended"],
  connected: ["reconnecting", "disconnected", "failed", "ended"],
  reconnecting: ["connected", "disconnected", "failed", "ended"],
  disconnected: ["idle", "prejoin", "token-loading", "failed", "ended"],
  ended: ["idle", "prejoin"],
  failed: ["idle", "prejoin", "token-loading", "ended"],
});

const noCapabilities = getMeetingCapabilities("guest", {
  canJoin: false, canPublishAudio: false, canPublishVideo: false, canShareScreen: false,
  canSendChat: false, canReact: false, canRaiseHand: false, canInvite: false,
  canAdmit: false, canManageParticipants: false, canManageRoles: false,
  canLockRoom: false, canEndRoom: false, canStartCaptions: false, canViewAttendance: false,
});

function initialSnapshot(generation = 0): MeetingClientSnapshot {
  return {
    schemaVersion: 1, generation, phase: "idle", context: null, role: null, capabilities: noCapabilities,
    participantIds: [], participantsById: {}, waitingEntry: null, layout: "grid", rightDock: "none",
    focusedParticipantId: null, focusedShareId: null, screenShares: [],
    localDevices: { inputId: "default", outputId: "default", permission: "prompt" },
    localMedia: { muted: true, deafened: false, cameraEnabled: false, screenSharing: false },
    noiseShield: { requested: false, applied: false, status: "off" }, handRaised: false, stageQueue: [], reactions: [],
    providerStatus: "idle", realtimeStatus: "idle", error: null, updatedAt: new Date(0).toISOString(),
  };
}

type Listener = () => void;
type Patch = Partial<Omit<MeetingClientSnapshot, "schemaVersion" | "generation">>;

export type MeetingStore = Readonly<{
  getSnapshot: () => MeetingClientSnapshot;
  subscribe: (listener: Listener) => () => void;
  begin: (context: MeetingClientContext) => number;
  transition: (generation: number, phase: MeetingClientPhase, patch?: Patch) => boolean;
  patch: (generation: number, patch: Patch) => boolean;
  replaceParticipants: (generation: number, participants: readonly MeetingClientParticipant[]) => boolean;
  setCapabilities: (generation: number, role: MeetingRole, capabilities: MeetingCapabilities) => boolean;
  setLayout: (layout: MeetingLayoutMode) => void;
  setRightDock: (panel: MeetingSidePanel) => void;
  setFocus: (participantId: string | null, shareId?: string | null) => void;
  setNoiseShield: (requested: boolean, applied: boolean, status: MeetingClientSnapshot["noiseShield"]["status"]) => void;
  setError: (generation: number, error: MeetingClientError) => boolean;
  appendReaction: (generation: number, reaction: MeetingClientReaction) => boolean;
  reset: () => void;
}>;

export function createMeetingStore(seed: MeetingClientSnapshot = initialSnapshot()): MeetingStore {
  let snapshot = seed;
  const listeners = new Set<Listener>();
  const publish = (next: MeetingClientSnapshot) => { snapshot = next; for (const listener of listeners) listener(); };
  const update = (generation: number, patch: Patch): boolean => {
    if (generation !== snapshot.generation) return false;
    publish({ ...snapshot, ...patch, updatedAt: new Date().toISOString() }); return true;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    begin(context) {
      const generation = snapshot.generation + 1;
      const next = initialSnapshot(generation);
      publish({ ...next, context, phase: "prejoin", layout: snapshot.layout, rightDock: snapshot.rightDock, localDevices: snapshot.localDevices, noiseShield: snapshot.noiseShield, updatedAt: new Date().toISOString() });
      return generation;
    },
    transition(generation, phase, patch = {}) {
      if (generation !== snapshot.generation) return false;
      if (phase !== snapshot.phase && !ALLOWED_TRANSITIONS[snapshot.phase].includes(phase)) return false;
      publish({ ...snapshot, ...patch, phase, updatedAt: new Date().toISOString() }); return true;
    },
    patch: update,
    replaceParticipants(generation, participants) {
      const participantsById = Object.fromEntries(participants.map((participant) => [participant.id, participant]));
      return update(generation, { participantIds: participants.map((participant) => participant.id), participantsById });
    },
    setCapabilities(generation, role, capabilities) { return update(generation, { role, capabilities }); },
    setLayout(layout) { publish({ ...snapshot, layout, updatedAt: new Date().toISOString() }); },
    setRightDock(rightDock) { publish({ ...snapshot, rightDock, updatedAt: new Date().toISOString() }); },
    setFocus(focusedParticipantId, focusedShareId = null) { publish({ ...snapshot, focusedParticipantId, focusedShareId, updatedAt: new Date().toISOString() }); },
    setNoiseShield(requested, applied, status) { publish({ ...snapshot, noiseShield: { requested, applied, status }, updatedAt: new Date().toISOString() }); },
    setError(generation, error) { return this.transition(generation, "failed", { error, providerStatus: error.providerCode ?? "error" }); },
    appendReaction(generation, reaction) {
      const now = Date.now();
      return update(generation, { reactions: [...snapshot.reactions.filter((item) => item.id !== reaction.id && Date.parse(item.expiresAt) > now), reaction].slice(-100) });
    },
    reset() { publish(initialSnapshot(snapshot.generation + 1)); },
  };
}

export const meetingStore = createMeetingStore();
export { ALLOWED_TRANSITIONS as MEETING_CLIENT_TRANSITIONS };
