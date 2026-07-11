import type { AudioPlayableItem } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import { podcastProgressService } from "./podcastProgressService";
import { voiceDeviceService } from "../voiceDeviceService";

export type AudioPlayerStatus = "idle" | "ready" | "loading" | "playing" | "paused" | "reconnecting" | "ended" | "error";
export const PODCAST_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type PodcastPlaybackRate = (typeof PODCAST_PLAYBACK_RATES)[number];
export type AudioPlayerServiceSnapshot = Readonly<{
  item: AudioPlayableItem | null;
  queue: readonly AudioPlayableItem[];
  queueIndex: number;
  status: AudioPlayerStatus;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: PodcastPlaybackRate;
  reconnectAttempt: number;
  error: string | null;
  progressError: string | null;
  resumedFrom: number | null;
}>;

const volumePreferenceKey = "picom.audio.volume.v1";
const playbackRatePreferenceKey = "picom.podcast.playbackRate.v1";
const listeners = new Set<(value: AudioPlayerServiceSnapshot) => void>();
let transport: HTMLAudioElement | null = null;
let ownedSourceUrl: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let playRequested = false;
let selectionRevision = 0;
let pendingResume: Promise<void> | null = null;
let lastProgressPosition = -1;

const isPodcast = (item: AudioPlayableItem | null): item is AudioPlayableItem => item?.type === "podcast_episode";

function readVolumePreference(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(volumePreferenceKey));
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.72;
  } catch {
    return 0.72;
  }
}

function readPlaybackRatePreference(): PodcastPlaybackRate {
  try {
    const value = Number(globalThis.localStorage?.getItem(playbackRatePreferenceKey));
    return PODCAST_PLAYBACK_RATES.includes(value as PodcastPlaybackRate) ? value as PodcastPlaybackRate : 1;
  } catch {
    return 1;
  }
}

let snapshot: AudioPlayerServiceSnapshot = {
  item: null,
  queue: [],
  queueIndex: -1,
  status: "idle",
  currentTime: 0,
  duration: 0,
  volume: readVolumePreference(),
  muted: false,
  playbackRate: readPlaybackRatePreference(),
  reconnectAttempt: 0,
  error: null,
  progressError: null,
  resumedFrom: null,
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
    transport.onloadedmetadata = null;
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

function persistPodcastProgress(force = false) {
  const item = snapshot.item;
  if (!isPodcast(item) || snapshot.currentTime <= 0) return;
  const position = snapshot.currentTime;
  const duration = snapshot.duration || item.durationSeconds;
  if (!force && Math.abs(position - lastProgressPosition) < 10) return;
  lastProgressPosition = position;
  void podcastProgressService.save({ episodeId: item.id, positionSeconds: position, durationSeconds: duration }).then((result) => {
    if (snapshot.item?.id !== item.id || snapshot.item.type !== item.type) return;
    publish({ ...snapshot, progressError: result.ok ? null : result.error });
  });
}

function beginResumeRestore(item: AudioPlayableItem, revision: number) {
  pendingResume = null;
  lastProgressPosition = -1;
  if (!isPodcast(item)) return;
  pendingResume = podcastProgressService.get(item.id).then((result) => {
    if (selectionRevision !== revision || snapshot.item?.id !== item.id || snapshot.item.type !== item.type) return;
    if (!result.ok) {
      publish({ ...snapshot, progressError: result.error, resumedFrom: null });
      return;
    }
    const saved = result.data;
    const duration = snapshot.duration || item.durationSeconds || saved?.durationSeconds || 0;
    const resumable = saved && !saved.completedAt && saved.positionSeconds > 0 && (!duration || saved.positionSeconds < Math.max(0, duration - 5));
    const position = resumable ? Math.min(saved.positionSeconds, duration || saved.positionSeconds) : 0;
    lastProgressPosition = position;
    if (transport && position > 0) {
      try { transport.currentTime = position; } catch { /* Metadata handler applies the restored position later. */ }
    }
    publish({ ...snapshot, currentTime: position, resumedFrom: position > 0 ? position : null, progressError: null });
  }).finally(() => {
    if (selectionRevision === revision) pendingResume = null;
  });
}

function normalizeQueue(item: AudioPlayableItem, queue: readonly AudioPlayableItem[]): readonly AudioPlayableItem[] {
  if (!isPodcast(item)) return [item];
  const unique = new Map<string, AudioPlayableItem>();
  for (const candidate of queue) if (isPodcast(candidate)) unique.set(candidate.id, candidate);
  if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()];
}

function failPlayback(message: string) {
  playRequested = false;
  cleanupTransport();
  publish({ ...snapshot, status: "error", error: message });
}

async function applySelectedOutput(audio: HTMLAudioElement): Promise<void> {
  const sinkAudio = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
  const outputId = voiceDeviceService.getSnapshot().selectedOutputId;
  if (!sinkAudio.setSinkId || outputId === "default") return;
  try { await sinkAudio.setSinkId(outputId); } catch { /* Playback remains available on the operating-system default output. */ }
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
    failPlayback(item.type === "radio_live" ? "This live Radio stream is not available yet." : "This Podcast episode is unavailable or private.");
    return null;
  }
  const audio = new Audio(source);
  transport = audio;
  void applySelectedOutput(audio);
  audio.preload = item.isLive ? "none" : "metadata";
  audio.loop = item.type === "radio_live" && dataSourceService.getStatus().isMock;
  audio.volume = snapshot.volume;
  audio.muted = snapshot.muted;
  audio.playbackRate = isPodcast(item) ? snapshot.playbackRate : 1;
  audio.onloadstart = () => publish({ ...snapshot, status: "loading", error: null });
  audio.onloadedmetadata = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : item.durationSeconds;
    if (snapshot.currentTime > 0) {
      try { audio.currentTime = Math.min(snapshot.currentTime, duration || snapshot.currentTime); } catch { /* Keep playback available even when seeking is unsupported. */ }
    }
    publish({ ...snapshot, duration });
  };
  audio.oncanplay = () => { if (!playRequested) publish({ ...snapshot, status: "ready", error: null }); };
  audio.onplaying = () => publish({ ...snapshot, status: "playing", reconnectAttempt: 0, error: null });
  audio.onpause = () => { if (snapshot.item && playRequested) publish({ ...snapshot, status: "paused" }); };
  audio.ontimeupdate = () => {
    publish({ ...snapshot, currentTime: audio.currentTime });
    persistPodcastProgress(false);
  };
  audio.ondurationchange = () => publish({ ...snapshot, duration: Number.isFinite(audio.duration) ? audio.duration : item.durationSeconds });
  audio.onwaiting = scheduleReconnect;
  audio.onstalled = scheduleReconnect;
  audio.onerror = () => item.isLive ? scheduleReconnect() : failPlayback("Picom could not play this Podcast episode. It may be unavailable or private.");
  audio.onended = () => {
    if (item.isLive) { scheduleReconnect(); return; }
    playRequested = false;
    publish({ ...snapshot, status: "ended", currentTime: snapshot.duration });
    persistPodcastProgress(true);
  };
  return audio;
}

voiceDeviceService.subscribePreferences(() => {
  if (transport) void applySelectedOutput(transport);
});

export const audioPlayerService = {
  getSnapshot: () => snapshot,
  subscribe(listener: (value: AudioPlayerServiceSnapshot) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  select(item: AudioPlayableItem, queue: readonly AudioPlayableItem[] = [item]) {
    const normalizedQueue = normalizeQueue(item, queue);
    const selectedItem = normalizedQueue.find((candidate) => candidate.id === item.id) ?? item;
    const queueIndex = normalizedQueue.findIndex((candidate) => candidate.id === selectedItem.id);
    if (snapshot.item?.id === selectedItem.id && snapshot.item.type === selectedItem.type) {
      publish({ ...snapshot, item: selectedItem, queue: normalizedQueue, queueIndex, duration: snapshot.duration || selectedItem.durationSeconds });
      return;
    }
    persistPodcastProgress(true);
    selectionRevision += 1;
    const revision = selectionRevision;
    playRequested = false;
    cleanupTransport();
    publish({
      ...snapshot,
      item: selectedItem,
      queue: normalizedQueue,
      queueIndex,
      status: "ready",
      currentTime: 0,
      duration: selectedItem.durationSeconds,
      playbackRate: isPodcast(selectedItem) ? snapshot.playbackRate : 1,
      reconnectAttempt: 0,
      error: null,
      progressError: null,
      resumedFrom: null,
    });
    beginResumeRestore(selectedItem, revision);
  },
  async play() {
    const selected = snapshot.item;
    if (!selected) return false;
    const restore = pendingResume;
    if (restore) await restore;
    if (!snapshot.item || snapshot.item.id !== selected.id || snapshot.item.type !== selected.type) return false;
    if (snapshot.status === "ended") audioPlayerService.seek(0);
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
    persistPodcastProgress(true);
  },
  togglePlayback() {
    if (snapshot.status === "playing" || snapshot.status === "loading" || snapshot.status === "reconnecting") {
      audioPlayerService.pause();
      return Promise.resolve(true);
    }
    return audioPlayerService.play();
  },
  seek(value: number) {
    if (!snapshot.item || snapshot.item.isLive) return;
    const next = Math.max(0, Math.min(snapshot.duration || snapshot.item.durationSeconds, value));
    if (transport) transport.currentTime = next;
    publish({ ...snapshot, currentTime: next, resumedFrom: null });
    persistPodcastProgress(false);
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
    audioPlayerService.setMuted(!snapshot.muted);
  },
  setPlaybackRate(value: number) {
    if (!isPodcast(snapshot.item) || !PODCAST_PLAYBACK_RATES.includes(value as PodcastPlaybackRate)) return;
    const playbackRate = value as PodcastPlaybackRate;
    if (transport) transport.playbackRate = playbackRate;
    try { globalThis.localStorage?.setItem(playbackRatePreferenceKey, String(playbackRate)); } catch { /* restricted storage fallback */ }
    publish({ ...snapshot, playbackRate });
  },
  async previous() {
    if (!isPodcast(snapshot.item)) return false;
    if (snapshot.currentTime > 5) {
      audioPlayerService.seek(0);
      return true;
    }
    if (snapshot.queueIndex <= 0) return false;
    const wasPlaying = snapshot.status === "playing" || snapshot.status === "loading";
    const queue = snapshot.queue;
    audioPlayerService.select(queue[snapshot.queueIndex - 1], queue);
    return wasPlaying ? audioPlayerService.play() : true;
  },
  async next() {
    if (!isPodcast(snapshot.item) || snapshot.queueIndex < 0 || snapshot.queueIndex >= snapshot.queue.length - 1) return false;
    const wasPlaying = snapshot.status === "playing" || snapshot.status === "loading";
    const queue = snapshot.queue;
    audioPlayerService.select(queue[snapshot.queueIndex + 1], queue);
    return wasPlaying ? audioPlayerService.play() : true;
  },
  stop() {
    persistPodcastProgress(true);
    playRequested = false;
    cleanupTransport();
    if (snapshot.item) publish({ ...snapshot, status: "ready", currentTime: 0, reconnectAttempt: 0, error: null, resumedFrom: null });
  },
  clear() {
    persistPodcastProgress(true);
    selectionRevision += 1;
    pendingResume = null;
    playRequested = false;
    cleanupTransport();
    publish({ ...snapshot, item: null, queue: [], queueIndex: -1, status: "idle", currentTime: 0, duration: 0, reconnectAttempt: 0, error: null, progressError: null, resumedFrom: null });
  },
  markEnded(message = "This broadcast has ended.") {
    playRequested = false;
    cleanupTransport();
    if (snapshot.item) publish({ ...snapshot, status: "ended", error: message });
  },
  markUnavailable(message = "This Podcast episode is unavailable, deleted, or private.") {
    playRequested = false;
    cleanupTransport();
    if (snapshot.item) publish({ ...snapshot, status: "error", error: message });
  },
  dispose() {
    persistPodcastProgress(true);
    playRequested = false;
    cleanupTransport();
  },
};
