import type { AudioProcessingErrorCode } from "../../types/audioProcessing";
import type {
  EnhancedNoiseMode,
  EnhancedNoiseProcessorAdapter,
  EnhancedNoiseProcessorProvider,
  EnhancedNoiseProcessorStatus,
  EnhancedNoiseProviderLoadResult,
  ProcessableMicrophoneTrack,
} from "./enhancedNoiseProcessorTypes";

export type EnhancedNoiseFilterSnapshot = Readonly<{
  requestedMode: EnhancedNoiseMode | null;
  status: EnhancedNoiseProcessorStatus;
  provider: string | null;
  attachedTrackId: string | null;
  initializationDurationMs: number | null;
  generation: number;
  errorCode: AudioProcessingErrorCode | null;
  reason: string | null;
}>;

type ProviderLoader = () => Promise<EnhancedNoiseProviderLoadResult>;
type Listener = (snapshot: EnhancedNoiseFilterSnapshot) => void;

const listeners = new Set<Listener>();
const defaultLoader: ProviderLoader = async () => {
  const runtime = await import("./officialLiveKitNoiseProcessorRuntime");
  return runtime.loadOfficialLiveKitNoiseProcessor();
};

let providerLoader: ProviderLoader = defaultLoader;
let activeTrack: ProcessableMicrophoneTrack | null = null;
let activeProcessor: EnhancedNoiseProcessorAdapter | null = null;
let snapshot: EnhancedNoiseFilterSnapshot = {
  requestedMode: null,
  status: "idle",
  provider: null,
  attachedTrackId: null,
  initializationDurationMs: null,
  generation: 0,
  errorCode: null,
  reason: null,
};

function emit(patch: Partial<EnhancedNoiseFilterSnapshot>): EnhancedNoiseFilterSnapshot {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}

async function releaseCurrent(nextStatus: EnhancedNoiseProcessorStatus, reason: string | null): Promise<EnhancedNoiseFilterSnapshot> {
  const track = activeTrack;
  const processor = activeProcessor;
  activeTrack = null;
  activeProcessor = null;
  if (track) await track.stopProcessor().catch(() => undefined);
  if (processor) await processor.dispose().catch(() => undefined);
  return emit({ status: nextStatus, attachedTrackId: null, provider: null, reason });
}

export const enhancedNoiseFilterService = {
  getSnapshot: (): EnhancedNoiseFilterSnapshot => snapshot,

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => listeners.delete(listener);
  },

  async attach(track: ProcessableMicrophoneTrack, source: "microphone" | "screen-share" | "media-playback", mode: EnhancedNoiseMode): Promise<EnhancedNoiseFilterSnapshot> {
    if (source !== "microphone") {
      return emit({ requestedMode: mode, status: "unsupported", errorCode: "PROCESSOR_UNSUPPORTED", reason: "Noise Shield processors are restricted to the local microphone track." });
    }
    if (activeTrack?.id === track.id && snapshot.requestedMode === mode && snapshot.status === "active") return snapshot;

    const generation = snapshot.generation + 1;
    await releaseCurrent("idle", null);
    const startedAt = performance.now();
    emit({ requestedMode: mode, status: "loading", generation, errorCode: null, reason: null, initializationDurationMs: null });

    let loaded: EnhancedNoiseProviderLoadResult;
    try {
      loaded = await providerLoader();
    } catch {
      return emit({ status: "fallback-standard", errorCode: "PROCESSOR_LOAD_FAILED", reason: "Enhanced Noise Shield could not load. Standard mode remains active.", initializationDurationMs: performance.now() - startedAt });
    }
    if (generation !== snapshot.generation) return snapshot;
    if (!loaded.ok) {
      return emit({ status: "fallback-standard", errorCode: loaded.code, reason: loaded.reason, initializationDurationMs: performance.now() - startedAt });
    }
    if (!loaded.provider.supportsMode(mode)) {
      return emit({ status: "fallback-standard", provider: loaded.provider.packageName, errorCode: "PROCESSOR_UNSUPPORTED", reason: `${mode === "voice-focus" ? "Voice Focus" : "Enhanced"} is unsupported by the configured provider. Standard mode remains active.`, initializationDurationMs: performance.now() - startedAt });
    }

    let adapter: EnhancedNoiseProcessorAdapter | null = null;
    try {
      emit({ status: "ready", provider: loaded.provider.packageName });
      adapter = await loaded.provider.createProcessor(mode);
      if (generation !== snapshot.generation) {
        await adapter.dispose().catch(() => undefined);
        return snapshot;
      }
      await track.setProcessor(adapter.processor as never);
      await adapter.setEnabled(true);
      if (generation !== snapshot.generation) {
        await track.stopProcessor().catch(() => undefined);
        await adapter.dispose().catch(() => undefined);
        return snapshot;
      }
      activeTrack = track;
      activeProcessor = adapter;
      return emit({ status: "active", provider: loaded.provider.packageName, attachedTrackId: track.id, errorCode: null, reason: null, initializationDurationMs: performance.now() - startedAt });
    } catch {
      await track.stopProcessor().catch(() => undefined);
      await adapter?.dispose().catch(() => undefined);
      return emit({ status: "fallback-standard", attachedTrackId: null, errorCode: "PROCESSOR_ATTACH_FAILED", reason: "Enhanced Noise Shield could not attach to the microphone. Standard mode remains active.", initializationDurationMs: performance.now() - startedAt });
    }
  },

  async detach(reason = "Noise processor detached from the microphone."): Promise<EnhancedNoiseFilterSnapshot> {
    emit({ generation: snapshot.generation + 1 });
    return releaseCurrent("disposed", reason);
  },

  async dispose(): Promise<EnhancedNoiseFilterSnapshot> {
    emit({ generation: snapshot.generation + 1, requestedMode: null });
    return releaseCurrent("disposed", "Noise processor resources were released.");
  },

  __setProviderLoaderForTests(loader: ProviderLoader | null): void {
    providerLoader = loader ?? defaultLoader;
  },

  __createSupportedTestProvider(factory: (mode: EnhancedNoiseMode) => Promise<EnhancedNoiseProcessorAdapter>): EnhancedNoiseProcessorProvider {
    return { packageName: "test-only-provider", supportsMode: () => true, createProcessor: factory };
  },
};
