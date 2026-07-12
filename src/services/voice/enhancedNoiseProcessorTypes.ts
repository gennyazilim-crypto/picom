import type { NoiseCancellationMode } from "../../types/audioProcessing";

export type EnhancedNoiseMode = Extract<NoiseCancellationMode, "enhanced" | "voice-focus">;

export type EnhancedNoiseProcessorStatus =
  | "idle"
  | "loading"
  | "ready"
  | "active"
  | "unsupported"
  | "failed"
  | "disposed"
  | "fallback-standard";

export type ProcessableMicrophoneTrack = Readonly<{
  id: string;
  mediaStreamTrack?: MediaStreamTrack;
  setProcessor: (processor: never) => Promise<void>;
  stopProcessor: () => Promise<void>;
}>;

export type EnhancedNoiseProcessorAdapter = Readonly<{
  processor: unknown;
  setEnabled: (enabled: boolean) => Promise<void>;
  dispose: () => Promise<void>;
}>;

export type EnhancedNoiseProcessorProvider = Readonly<{
  packageName: string;
  supportsMode: (mode: EnhancedNoiseMode) => boolean;
  createProcessor: (mode: EnhancedNoiseMode) => Promise<EnhancedNoiseProcessorAdapter>;
}>;

export type EnhancedNoiseProviderLoadResult =
  | Readonly<{ ok: true; provider: EnhancedNoiseProcessorProvider }>
  | Readonly<{ ok: false; code: "PROCESSOR_PACKAGE_UNAVAILABLE" | "PROCESSOR_UNSUPPORTED"; reason: string }>;
