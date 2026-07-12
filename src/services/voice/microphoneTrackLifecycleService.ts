export type MicrophoneAudioSource = "microphone" | "screen-share" | "radio" | "podcast" | "media-playback" | "music";

export type MicrophoneLifecycleEventCode =
  | "safe_mode_idle"
  | "initial_attach"
  | "duplicate_attach_prevented"
  | "duplicate_processor_prevented"
  | "mute"
  | "unmute"
  | "device_switch"
  | "device_removed_fallback"
  | "permission_denied"
  | "permission_restored"
  | "reconnect"
  | "mode_switch"
  | "processor_detached"
  | "track_replaced"
  | "track_released"
  | "room_disconnected"
  | "room_cleanup"
  | "app_shutdown"
  | "fallback_standard"
  | "source_isolated"
  | "cleanup_skipped"
  | "cleanup_complete";

export type ManagedMicrophoneTrack = Readonly<{
  id: string;
  mediaStreamTrack?: Pick<MediaStreamTrack, "id" | "readyState" | "stop">;
}>;

export type MicrophoneLifecycleEvent = Readonly<{
  code: MicrophoneLifecycleEventCode;
  at: string;
  generation: number;
  trackKey?: string;
  deviceKey?: string;
}>;

export type MicrophoneTrackLifecycleSnapshot = Readonly<{
  active: boolean;
  activeTrackKey: string | null;
  processorAttached: boolean;
  generation: number;
  pendingOperations: number;
  permission: "prompt" | "granted" | "denied" | "unsupported";
  selectedDeviceKey: string | null;
  lastEvent: MicrophoneLifecycleEventCode;
  events: readonly MicrophoneLifecycleEvent[];
}>;

type LifecycleListener = (snapshot: MicrophoneTrackLifecycleSnapshot) => void;
type ShutdownTarget = Pick<Window, "addEventListener" | "removeEventListener">;
type DisposeProcessor = () => Promise<unknown> | unknown;

const MAX_SAFE_EVENTS = 64;

function safeIdentifier(value: string | null | undefined, prefix: "track" | "device"): string | null {
  if (!value) return null;
  if (value === "default") return "default";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createMicrophoneTrackLifecycleManager() {
  const listeners = new Set<LifecycleListener>();
  let activeTrack: ManagedMicrophoneTrack | null = null;
  let queue: Promise<void> = Promise.resolve();
  let shutdownTarget: ShutdownTarget | null = null;
  let shutdownHandler: (() => void) | null = null;
  let shutdownProcessorCleanup: DisposeProcessor | null = null;
  let snapshot: MicrophoneTrackLifecycleSnapshot = {
    active: false,
    activeTrackKey: null,
    processorAttached: false,
    generation: 0,
    pendingOperations: 0,
    permission: "prompt",
    selectedDeviceKey: null,
    lastEvent: "safe_mode_idle",
    events: [{ code: "safe_mode_idle", at: new Date().toISOString(), generation: 0 }],
  };

  const emit = (patch: Partial<MicrophoneTrackLifecycleSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const record = (code: MicrophoneLifecycleEventCode, detail: Pick<MicrophoneLifecycleEvent, "trackKey" | "deviceKey"> = {}) => {
    const event: MicrophoneLifecycleEvent = {
      code,
      at: new Date().toISOString(),
      generation: snapshot.generation,
      ...(detail.trackKey ? { trackKey: detail.trackKey } : {}),
      ...(detail.deviceKey ? { deviceKey: detail.deviceKey } : {}),
    };
    return emit({ lastEvent: code, events: [...snapshot.events, event].slice(-MAX_SAFE_EVENTS) });
  };

  const releaseCurrent = (reason: MicrophoneLifecycleEventCode = "track_released", stopTrack = false): boolean => {
    const current = activeTrack;
    activeTrack = null;
    if (stopTrack && current?.mediaStreamTrack?.readyState === "live") current.mediaStreamTrack.stop();
    emit({ active: false, activeTrackKey: null, processorAttached: false });
    if (current) record(reason, { trackKey: safeIdentifier(current.id, "track") ?? undefined });
    return Boolean(current);
  };

  const shutdownNow = () => {
    snapshot = { ...snapshot, generation: snapshot.generation + 1 };
    releaseCurrent("app_shutdown", true);
    const cleanup = shutdownProcessorCleanup;
    if (cleanup) void Promise.resolve(cleanup()).catch(() => undefined);
  };

  return {
    getSnapshot: (): MicrophoneTrackLifecycleSnapshot => snapshot,

    subscribe(listener: LifecycleListener): () => void {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },

    runExclusive<T>(code: MicrophoneLifecycleEventCode, operation: () => Promise<T>): Promise<T> {
      emit({ pendingOperations: snapshot.pendingOperations + 1 });
      const run = queue.then(async () => {
        emit({ generation: snapshot.generation + 1 });
        record(code);
        try {
          return await operation();
        } finally {
          emit({ pendingOperations: Math.max(0, snapshot.pendingOperations - 1) });
        }
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },

    async prepareProcessorReplacement(detachProcessor: DisposeProcessor): Promise<void> {
      if (!snapshot.processorAttached && !activeTrack) return;
      await Promise.resolve(detachProcessor()).catch(() => undefined);
      emit({ processorAttached: false });
      record("processor_detached", { trackKey: snapshot.activeTrackKey ?? undefined });
    },

    adoptTrack(track: ManagedMicrophoneTrack, source: MicrophoneAudioSource, code: MicrophoneLifecycleEventCode = "initial_attach"): "adopted" | "duplicate" | "rejected" {
      if (source !== "microphone") {
        record("source_isolated");
        return "rejected";
      }
      if (activeTrack?.id === track.id) {
        record("duplicate_attach_prevented", { trackKey: safeIdentifier(track.id, "track") ?? undefined });
        return "duplicate";
      }
      const previous = activeTrack;
      if (previous?.mediaStreamTrack?.readyState === "live") previous.mediaStreamTrack.stop();
      activeTrack = track;
      const activeTrackKey = safeIdentifier(track.id, "track");
      emit({ active: true, activeTrackKey, processorAttached: false });
      record(previous ? "track_replaced" : code, { trackKey: activeTrackKey ?? undefined });
      return "adopted";
    },

    markProcessorAttached(trackId: string): boolean {
      if (activeTrack?.id !== trackId || snapshot.processorAttached) {
        record("duplicate_processor_prevented", { trackKey: safeIdentifier(trackId, "track") ?? undefined });
        return false;
      }
      emit({ processorAttached: true });
      return true;
    },

    releaseCurrent,

    async cleanup(
      code: Extract<MicrophoneLifecycleEventCode, "room_disconnected" | "room_cleanup" | "app_shutdown">,
      disposeProcessor: DisposeProcessor,
      stopTrack = true,
      expectedTrackId?: string | null,
    ): Promise<boolean> {
      return this.runExclusive(code, async () => {
        if (expectedTrackId && activeTrack && activeTrack.id !== expectedTrackId) {
          record("cleanup_skipped", { trackKey: safeIdentifier(expectedTrackId, "track") ?? undefined });
          return false;
        }
        await Promise.resolve(disposeProcessor()).catch(() => undefined);
        releaseCurrent("track_released", stopTrack);
        record("cleanup_complete");
        return true;
      });
    },

    noteDeviceState(deviceId: string, removedFallback = false): void {
      const deviceKey = safeIdentifier(deviceId, "device");
      emit({ selectedDeviceKey: deviceKey });
      if (removedFallback) record("device_removed_fallback", { deviceKey: deviceKey ?? undefined });
    },

    notePermission(permission: MicrophoneTrackLifecycleSnapshot["permission"]): void {
      const previous = snapshot.permission;
      emit({ permission });
      if (permission === "denied") record("permission_denied");
      else if (permission === "granted" && previous === "denied") record("permission_restored");
    },

    noteFallback(): void {
      record("fallback_standard");
    },

    bindShutdown(disposeProcessor: DisposeProcessor, target?: ShutdownTarget | null): () => void {
      shutdownProcessorCleanup = disposeProcessor;
      const resolvedTarget = target ?? (typeof window !== "undefined" ? window : null);
      if (!resolvedTarget) return () => undefined;
      if (!shutdownHandler) {
        shutdownTarget = resolvedTarget;
        shutdownHandler = shutdownNow;
        shutdownTarget.addEventListener("beforeunload", shutdownHandler);
      }
      return () => {
        if (shutdownTarget && shutdownHandler) shutdownTarget.removeEventListener("beforeunload", shutdownHandler);
        shutdownTarget = null;
        shutdownHandler = null;
        shutdownProcessorCleanup = null;
      };
    },

    diagnostics() {
      return {
        active: snapshot.active,
        activeTrackKey: snapshot.activeTrackKey,
        processorAttached: snapshot.processorAttached,
        generation: snapshot.generation,
        pendingOperations: snapshot.pendingOperations,
        permission: snapshot.permission,
        selectedDeviceKey: snapshot.selectedDeviceKey,
        lastEvent: snapshot.lastEvent,
        events: snapshot.events,
      } as const;
    },
  };
}

export const microphoneTrackLifecycleService = createMicrophoneTrackLifecycleManager();
