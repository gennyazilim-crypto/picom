export type NoiseShieldMode = "off" | "standard" | "enhanced" | "voice_focus";
export type NoiseShieldStatus = "off" | "requested" | "applied" | "fallback" | "unavailable" | "failed";
export type NoiseShieldProvider = "none" | "chromium_native";

export type NoiseShieldMicrophoneConstraints = {
  deviceId?: ConstrainDOMString;
  echoCancellation?: ConstrainBoolean;
  noiseSuppression?: ConstrainBoolean;
  autoGainControl?: ConstrainBoolean;
};

export type NoiseShieldSnapshot = Readonly<{
  scope: "meeting" | null;
  roomId: string | null;
  requestedMode: NoiseShieldMode;
  appliedMode: NoiseShieldMode;
  availableModes: readonly NoiseShieldMode[];
  provider: NoiseShieldProvider;
  status: NoiseShieldStatus;
  fallbackReason: string | null;
  revision: number;
  lastAppliedAt: string | null;
}>;

export type NoiseShieldCapturePlan = Readonly<{
  constraints: NoiseShieldMicrophoneConstraints;
  requestedMode: NoiseShieldMode;
  appliedMode: NoiseShieldMode;
  provider: NoiseShieldProvider;
}>;
