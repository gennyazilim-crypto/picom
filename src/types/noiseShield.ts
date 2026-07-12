import type {
  AppliedAudioProcessingSettings,
  AudioCaptureConstraints,
  AudioProcessingApplicationResult,
  AudioProcessingCapabilities,
  AudioProcessingCapturePlan,
  AudioProcessingErrorCode,
  AudioProcessingSettings,
  NoiseCancellationMode,
} from "./audioProcessing";

export type NoiseShieldMode = NoiseCancellationMode;
export type NoiseShieldStatus = "off" | "idle" | "loading" | "ready" | "requested" | "active" | "applied" | "fallback" | "fallback-standard" | "unsupported" | "unavailable" | "failed" | "disposed";
export type NoiseShieldProvider = "none" | "chromium_native" | "livekit_krisp";

export type NoiseShieldMicrophoneConstraints = AudioCaptureConstraints;

export type NoiseShieldSnapshot = Readonly<{
  scope: "voice" | "meeting" | null;
  roomId: string | null;
  settings: AudioProcessingSettings;
  capabilities: AudioProcessingCapabilities;
  requestedMode: NoiseShieldMode;
  appliedMode: NoiseShieldMode;
  availableModes: readonly NoiseShieldMode[];
  provider: NoiseShieldProvider;
  status: NoiseShieldStatus;
  fallbackReason: string | null;
  errorCode: AudioProcessingErrorCode | null;
  processorStatus: "idle" | "loading" | "ready" | "active" | "unsupported" | "failed" | "disposed" | "fallback-standard";
  processorInitializationDurationMs: number | null;
  application: AudioProcessingApplicationResult | null;
  appliedSettings: AppliedAudioProcessingSettings;
  revision: number;
  lastAppliedAt: string | null;
}>;

export type NoiseShieldCapturePlan = AudioProcessingCapturePlan & Readonly<{
  provider: NoiseShieldProvider;
}>;
