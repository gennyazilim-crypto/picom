import type { AudioProcessingErrorCode, NoiseCancellationMode } from "../../types/audioProcessing";
import { noiseShieldService } from "../noiseShieldService";
import { voiceDeviceService } from "../voiceDeviceService";
import { microphoneTrackLifecycleService } from "./microphoneTrackLifecycleService";

export type NoiseShieldDiagnosticsSnapshot = Readonly<{
  generatedAt: string;
  requestedMode: NoiseCancellationMode;
  appliedMode: NoiseCancellationMode;
  provider: string;
  status: string;
  supportedConstraints: Readonly<{
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  }>;
  appliedTrackSettings: Readonly<{
    echoCancellation: boolean | null;
    noiseSuppression: boolean | null;
    autoGainControl: boolean | null;
    deviceIdApplied: boolean | null;
  }> | null;
  processorState: string | null;
  processorInitializationDurationMs: number | null;
  inputDeviceKey: string;
  permission: string;
  fallbackReason: string | null;
  errorCode: AudioProcessingErrorCode | null;
  lifecycle: Readonly<{
    active: boolean;
    processorAttached: boolean;
    generation: number;
    pendingOperations: number;
    lastEvent: string;
    retainedEventCount: number;
  }>;
  performance: Readonly<{
    cpuApproximation: "inactive" | "browser-managed" | "provider-active-external-measurement-required";
    rendererMemoryBucket: "unavailable" | "under-128-mib" | "128-256-mib" | "256-512-mib" | "over-512-mib";
    lazyInitializationDurationMs: number | null;
  }>;
  privacy: Readonly<{
    rawAudioCaptured: false;
    rawWaveformExported: false;
    deviceLabelIncluded: false;
    fullDeviceIdIncluded: false;
    sessionObjectIncluded: false;
  }>;
}>;

type DiagnosticsListener = () => void;
type ChromiumPerformance = Performance & Readonly<{ memory?: Readonly<{ usedJSHeapSize?: number }> }>;

const listeners = new Set<DiagnosticsListener>();
let sourceCleanups: (() => void)[] = [];

function hashDeviceId(value: string): string {
  if (!value || value === "default") return "default";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `device-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function rendererMemoryBucket(): NoiseShieldDiagnosticsSnapshot["performance"]["rendererMemoryBucket"] {
  if (typeof performance === "undefined") return "unavailable";
  const bytes = (performance as ChromiumPerformance).memory?.usedJSHeapSize;
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "unavailable";
  const mib = bytes / (1024 * 1024);
  if (mib < 128) return "under-128-mib";
  if (mib < 256) return "128-256-mib";
  if (mib < 512) return "256-512-mib";
  return "over-512-mib";
}

function buildSnapshot(): NoiseShieldDiagnosticsSnapshot {
  const processing = noiseShieldService.diagnostics();
  const lifecycle = microphoneTrackLifecycleService.diagnostics();
  const devices = voiceDeviceService.getSnapshot();
  const cpuApproximation = processing.appliedMode === "off"
    ? "inactive"
    : processing.provider === "chromium_native"
      ? "browser-managed"
      : "provider-active-external-measurement-required";
  return {
    generatedAt: new Date().toISOString(),
    requestedMode: processing.requestedMode,
    appliedMode: processing.appliedMode,
    provider: processing.provider,
    status: processing.status,
    supportedConstraints: processing.supportedConstraints,
    appliedTrackSettings: processing.appliedSettings,
    processorState: processing.processorStatus,
    processorInitializationDurationMs: processing.processorInitializationDurationMs,
    inputDeviceKey: lifecycle.selectedDeviceKey ?? hashDeviceId(devices.selectedInputId),
    permission: devices.permission,
    fallbackReason: processing.fallbackReason,
    errorCode: processing.errorCode,
    lifecycle: {
      active: lifecycle.active,
      processorAttached: lifecycle.processorAttached,
      generation: lifecycle.generation,
      pendingOperations: lifecycle.pendingOperations,
      lastEvent: lifecycle.lastEvent,
      retainedEventCount: lifecycle.events.length,
    },
    performance: {
      cpuApproximation,
      rendererMemoryBucket: rendererMemoryBucket(),
      lazyInitializationDurationMs: processing.processorInitializationDurationMs,
    },
    privacy: {
      rawAudioCaptured: false,
      rawWaveformExported: false,
      deviceLabelIncluded: false,
      fullDeviceIdIncluded: false,
      sessionObjectIncluded: false,
    },
  };
}

let snapshot = buildSnapshot();

function refresh(): void {
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener());
}

function connectSources(): void {
  if (sourceCleanups.length > 0) return;
  sourceCleanups = [
    noiseShieldService.subscribe(refresh),
    microphoneTrackLifecycleService.subscribe(refresh),
    voiceDeviceService.subscribe(refresh),
  ];
}

function disconnectSources(): void {
  sourceCleanups.forEach((cleanup) => cleanup());
  sourceCleanups = [];
}

export const noiseShieldDiagnosticsService = {
  getSnapshot: (): NoiseShieldDiagnosticsSnapshot => snapshot,

  subscribe(listener: DiagnosticsListener): () => void {
    listeners.add(listener);
    connectSources();
    refresh();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) disconnectSources();
    };
  },

  refresh(): NoiseShieldDiagnosticsSnapshot {
    refresh();
    return snapshot;
  },
};
