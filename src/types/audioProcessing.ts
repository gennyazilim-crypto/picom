export type NoiseCancellationMode = "off" | "standard" | "enhanced" | "voice-focus";

export type AudioProcessingSettings = Readonly<{
  noiseCancellationMode: NoiseCancellationMode;
  echoCancellation: boolean;
  autoGainControl: boolean;
  preferredInputDeviceId?: string;
  rememberForDevice: boolean;
}>;

export type AudioCaptureConstraints = {
  deviceId?: ConstrainDOMString;
  echoCancellation?: ConstrainBoolean;
  noiseSuppression?: ConstrainBoolean;
  autoGainControl?: ConstrainBoolean;
};

export type AudioConstraintSupport = Readonly<{
  deviceId: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}>;

export type AudioProcessingCapabilities = Readonly<{
  mediaDevices: boolean;
  constraints: AudioConstraintSupport;
  trackSettings: boolean;
  audioWorklet: boolean;
  webAssembly: boolean;
  enhancedProvider: boolean;
  voiceFocusProvider: boolean;
}>;

export type AppliedAudioProcessingSettings = Readonly<{
  echoCancellation: boolean | null;
  noiseSuppression: boolean | null;
  autoGainControl: boolean | null;
  deviceIdApplied: boolean | null;
}>;

export type AudioProcessingApplicationResult = Readonly<{
  requested: AppliedAudioProcessingSettings;
  supported: AudioConstraintSupport;
  applied: AppliedAudioProcessingSettings;
  verified: boolean;
  fallbackReason: string | null;
}>;

export type AudioProcessingCapturePlan = Readonly<{
  constraints: AudioCaptureConstraints;
  requestedMode: NoiseCancellationMode;
  appliedMode: NoiseCancellationMode;
  requested: AppliedAudioProcessingSettings;
  supported: AudioConstraintSupport;
  fallbackReason: string | null;
}>;

export type AudioProcessingErrorCode =
  | "MEDIA_UNSUPPORTED"
  | "MIC_PERMISSION_REQUIRED"
  | "MIC_DEVICE_UNAVAILABLE"
  | "STANDARD_PARTIAL"
  | "PROCESSOR_PACKAGE_UNAVAILABLE"
  | "PROCESSOR_UNSUPPORTED"
  | "PROCESSOR_LOAD_FAILED"
  | "PROCESSOR_ATTACH_FAILED"
  | "PROCESSOR_DISPOSED";

export function normalizeNoiseCancellationMode(value: unknown): NoiseCancellationMode {
  if (value === "voice_focus") return "voice-focus";
  return value === "off" || value === "standard" || value === "enhanced" || value === "voice-focus"
    ? value
    : "standard";
}
