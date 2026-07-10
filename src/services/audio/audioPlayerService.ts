import type { AudioPlayableItem } from "../../types/audio";

export type AudioPlayerServiceSnapshot = Readonly<{
  item: AudioPlayableItem | null;
  status: "idle" | "ready" | "playing" | "paused";
  volume: number;
  muted: boolean;
}>;

let snapshot: AudioPlayerServiceSnapshot = { item: null, status: "idle", volume: 0.72, muted: false };
const listeners = new Set<(value: AudioPlayerServiceSnapshot) => void>();

function publish(next: AudioPlayerServiceSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

export const audioPlayerService = {
  getSnapshot: () => snapshot,
  subscribe(listener: (value: AudioPlayerServiceSnapshot) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  select(item: AudioPlayableItem) { publish({ ...snapshot, item, status: "ready" }); },
  markPlaying() { if (snapshot.item) publish({ ...snapshot, status: "playing" }); },
  markPaused() { if (snapshot.item) publish({ ...snapshot, status: "paused" }); },
  setVolume(volume: number) { publish({ ...snapshot, volume: Math.min(1, Math.max(0, volume)) }); },
  setMuted(muted: boolean) { publish({ ...snapshot, muted }); },
  clear() { publish({ ...snapshot, item: null, status: "idle" }); },
};
