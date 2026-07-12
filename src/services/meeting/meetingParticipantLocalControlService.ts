import type { MeetingParticipantLocalControls } from "../../types/meetingParticipantControls";
import { meetingLiveKitAdapter } from "./meetingLiveKitAdapter";

const DEFAULT_CONTROLS: MeetingParticipantLocalControls = Object.freeze({
  volume: 1,
  locallyMuted: false,
  selfViewVisible: true,
});

const controls = new Map<string, MeetingParticipantLocalControls>();
const listeners = new Set<() => void>();
let revision = 0;

function normalizeVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
}

function publish(identity: string, next: MeetingParticipantLocalControls): MeetingParticipantLocalControls {
  controls.set(identity, Object.freeze(next));
  revision += 1;
  listeners.forEach((listener) => listener());
  return next;
}

function applyVolume(identity: string, next: MeetingParticipantLocalControls): boolean {
  return meetingLiveKitAdapter.setParticipantLocalVolume(identity, next.locallyMuted ? 0 : next.volume);
}

export const meetingParticipantLocalControlService = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getRevision(): number {
    return revision;
  },
  get(identity: string): MeetingParticipantLocalControls {
    return controls.get(identity) ?? DEFAULT_CONTROLS;
  },
  setVolume(identity: string, volume: number): MeetingParticipantLocalControls {
    const current = this.get(identity);
    const next = publish(identity, { ...current, volume: normalizeVolume(volume) });
    applyVolume(identity, next);
    return next;
  },
  setLocallyMuted(identity: string, locallyMuted: boolean): MeetingParticipantLocalControls {
    const current = this.get(identity);
    const next = publish(identity, { ...current, locallyMuted });
    applyVolume(identity, next);
    return next;
  },
  setSelfViewVisible(identity: string, selfViewVisible: boolean): MeetingParticipantLocalControls {
    return publish(identity, { ...this.get(identity), selfViewVisible });
  },
  reset(): void {
    controls.clear();
    revision += 1;
    listeners.forEach((listener) => listener());
  },
};
