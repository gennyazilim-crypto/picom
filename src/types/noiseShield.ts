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
export type NoiseShieldStatus = "off" | "requested" | "applied" | "fallback" | "unavailable" | "failed";
export type NoiseShieldProvider = "none" | "chromium_native";

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
  application: AudioProcessingApplicationResult | null;
  appliedSettings: AppliedAudioProcessingSettings;
  revision: number;
  lastAppliedAt: string | null;
}>;

export type NoiseShieldCapturePlan = AudioProcessingCapturePlan & Readonly<{
  provider: NoiseShieldProvider;
}>;
