import type { AudioPlayableItem } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";

export type AudioPlayerStatus = "idle" | "ready" | "loading" | "playing" | "paused" | "reconnecting" | "ended" | "error";
export type AudioPlayerServiceSnapshot = Readonly<{
  item: AudioPlayableItem | null;
  status: AudioPlayerStatus;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  reconnectAttempt: number;
  error: string | null;
}>;

const volumePreferenceKey = "picom.audio.volume.v1";
const listeners = new Set<(value: AudioPlayerServiceSnapshot) => void>();
let transport: HTMLAudioElement | null = null;
let ownedSourceUrl: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let playRequested = false;

function readVolumePreference(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(volumePreferenceKey));
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.72;
  } catch {
    return 0.72;
  }
}

let snapshot: AudioPlayerServiceSnapshot = {
  item: null,
  status: "idle",
  currentTime: 0,
  duration: 0,
  volume: readVolumePreference(),
  muted: false,
  reconnectAttempt: 0,
  error: null,
};

function publish(next: AudioPlayerServiceSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function createMockRadioSource(): string | null {
  if (typeof Blob === "undefined" || typeof URL?.createObjectURL !== "function") return null;
  const sampleRate = 8000;
  const dataBytes = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  ownedSourceUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return ownedSourceUrl;
}

function safeSource(item: AudioPlayableItem): string | null {
  if (!item.audioUrl) return item.type === "radio_live" && dataSourceService.getStatus().isMock ? createMockRadioSource() : null;
  try {
    const source = new URL(item.audioUrl, globalThis.location?.href);
    const localHttp = source.protocol === "http:" && ["127.0.0.1", "localhost"].includes(source.hostname);
    return source.protocol === "https:" || source.protocol === "blob:" || source.protocol === "data:" || localHttp ? source.href : null;
  } catch {
    return null;
  }
}

function cleanupTransport() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (transport) {
    transport.onloadstart = null;
    transport.oncanplay = null;
    transport.onplaying = null;
    transport.onpause = null;
    transport.ontimeupdate = null;
    transport.ondurationchange = null;
    transport.onwaiting = null;
    transport.onstalled = null;
    transport.onerror = null;
    transport.onended = null;
    transport.pause();
    transport.removeAttribute("src");
    transport.load();
    transport = null;
  }
  if (ownedSourceUrl) URL.revokeObjectURL(ownedSourceUrl);
  ownedSourceUrl = null;
}

function failPlayback(message: string) {
  playRequested = false;
  cleanupTransport();
  publish({ ...snapshot, status: "error", error: message });
}

function scheduleReconnect() {
  const item = snapshot.item;
  if (!playRequested || !item?.isLive) return;
  if (snapshot.reconnectAttempt >= 3) {
    failPlayback("The live Radio stream could not reconnect. Try again.");
    return;
  }
  const attempt = snapshot.reconnectAttempt + 1;
  publish({ ...snapshot, status: "reconnecting", reconnectAttempt: attempt, error: null });
  reconnectTimer = setTimeout(() => {
    const current = snapshot.item;
    cleanupTransport();
    if (!current || !playRequested) return;
    const next = ensureTransport(current);
    if (!next) return;
    void next.play().catch(() => scheduleReconnect());
  }, Math.min(4000, 700 * 2 ** (attempt - 1)));
}

function ensureTransport(item: AudioPlayableItem): HTMLAudioElement | null {
  if (transport) return transport;
  const source = safeSource(item);
  if (!source || typeof Audio === "undefined") {
    failPlayback(item.type === "radio_live" ? "This live Radio stream is not available yet." : "This audio source is unavailable.");
    return null;
  }
  const audio = new Audio(source);
  transport = audio;
  audio.preload = "none";
  audio.loop = item.type === "radio_live" && dataSourceService.getStatus().isMock;
  audio.volume = snapshot.volume;
  audio.muted = snapshot.muted;
  audio.onloadstart = () => publish({ ...snapshot, status: "loading", error: null });
  audio.oncanplay = () => { if (!playRequested) publish({ ...snapshot, status: "ready", error: null }); };
  audio.onplaying = () => publish({ ...snapshot, status: "playing", reconnectAttempt: 0, error: null });
  audio.onpause = () => { if (snapshot.item && playRequested) publish({ ...snapshot, status: "paused" }); };
  audio.ontimeupdate = () => publish({ ...snapshot, currentTime: audio.currentTime });
  audio.ondurationchange = () => publish({ ...snapshot, duration: Number.isFinite(audio.duration) ? audio.duration : item.durationSeconds });
  audio.onwaiting = scheduleReconnect;
  audio.onstalled = scheduleReconnect;
  audio.onerror = () => item.isLive ? scheduleReconnect() : failPlayback("Picom could not play this audio source.");
  audio.onended = () => item.isLive ? scheduleReconnect() : (playRequested = false, publish({ ...snapshot, status: "ended", currentTime: snapshot.duration }));
  return audio;
}

export const audioPlayerService = {
  getSnapshot: () => snapshot,
  subscribe(listener: (value: AudioPlayerServiceSnapshot) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  select(item: AudioPlayableItem) {
    if (snapshot.item?.id === item.id && snapshot.item.type === item.type) {
      publish({ ...snapshot, item, duration: snapshot.duration || item.durationSeconds });
      return;
    }
    playRequested = false;
    cleanupTransport();
    publish({ ...snapshot, item, status: "ready", currentTime: 0, duration: item.durationSeconds, reconnectAttempt: 0, error: null });
  },
  async play() {
    if (!snapshot.item || snapshot.status === "ended") return false;
    playRequested = true;
    publish({ ...snapshot, status: "loading", error: null });
    const audio = ensureTransport(snapshot.item);
    if (!audio) return false;
    try {
      await audio.play();
      return true;
    } catch {
      failPlayback("Playback was blocked or the audio source is unavailable.");
      return false;
    }
  },
  pause() {
    playRequested = false;
    transport?.pause();
    if (snapshot.item) publish({ ...snapshot, status: "paused" });
  },
  togglePlayback() {
    if (snapshot.status === "playing" || snapshot.status === "loading" || snapshot.status === "reconnecting") {
      playRequested = false;
      transport?.pause();
      if (snapshot.item) publish({ ...snapshot, status: "paused" });
      return Promise.resolve(true);
    }
    return audioPlayerService.play();
  },
  seek(value: number) {
    if (!snapshot.item || snapshot.item.isLive) return;
    const next = Math.max(0, Math.min(snapshot.duration, value));
    if (transport) transport.currentTime = next;
    publish({ ...snapshot, currentTime: next });
  },
  setVolume(value: number) {
    const volume = Math.min(1, Math.max(0, value));
    if (transport) transport.volume = volume;
    try { globalThis.localStorage?.setItem(volumePreferenceKey, String(volume)); } catch { /* restricted storage fallback */ }
    publish({ ...snapshot, volume });
  },
  setMuted(muted: boolean) {
    if (transport) transport.muted = muted;
    publish({ ...snapshot, muted });
  },
  toggleMuted() {
    const muted = !snapshot.muted;
    if (transport) transport.muted = muted;
    publish({ ...snapshot, muted });
  },
  stop() {
    playRequested = false;
    cleanupTransport();
    if (snapshot.item) publish({ ...snapshot, status: "ready", currentTime: 0, reconnectAttempt: 0, error: null });
  },
  clear() {
    playRequested = false;
    cleanupTransport();
    publish({ ...snapshot, item: null, status: "idle", currentTime: 0, duration: 0, reconnectAttempt: 0, error: null });
  },
  markEnded(message = "This broadcast has ended.") {
    playRequested = false;
    cleanupTransport();
    if (snapshot.item) publish({ ...snapshot, status: "ended", error: message });
  },
  dispose() {
    playRequested = false;
    cleanupTransport();
  },
};
