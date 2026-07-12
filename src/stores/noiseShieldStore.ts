import type { NoiseShieldSnapshot } from "../types/noiseShield";

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: NoiseShieldSnapshot = {
  scope: null,
  roomId: null,
  settings: { noiseCancellationMode: "standard", echoCancellation: true, autoGainControl: true, rememberForDevice: true },
  capabilities: {
    mediaDevices: false,
    constraints: { deviceId: false, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    trackSettings: false,
    audioWorklet: false,
    webAssembly: false,
    enhancedProvider: false,
    voiceFocusProvider: false,
  },
  requestedMode: "standard",
  appliedMode: "off",
  availableModes: ["off"],
  provider: "none",
  status: "off",
  fallbackReason: null,
  errorCode: null,
  processorStatus: "idle",
  processorInitializationDurationMs: null,
  application: null,
  appliedSettings: { echoCancellation: null, noiseSuppression: null, autoGainControl: null, deviceIdApplied: null },
  revision: 0,
  lastAppliedAt: null,
};

export const noiseShieldStore = {
  getSnapshot: (): NoiseShieldSnapshot => snapshot,
  subscribe(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  patch(patch: Partial<NoiseShieldSnapshot>): NoiseShieldSnapshot { snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 }; listeners.forEach((listener) => listener()); return snapshot; },
  reset(): NoiseShieldSnapshot {
    snapshot = {
      ...snapshot,
      scope: null,
      roomId: null,
      requestedMode: snapshot.settings.noiseCancellationMode,
      appliedMode: "off",
      provider: "none",
      status: "off",
      fallbackReason: null,
      errorCode: null,
      processorStatus: "disposed",
      processorInitializationDurationMs: null,
      application: null,
      appliedSettings: { echoCancellation: null, noiseSuppression: null, autoGainControl: null, deviceIdApplied: null },
      lastAppliedAt: null,
      revision: snapshot.revision + 1,
    };
    listeners.forEach((listener) => listener());
    return snapshot;
  },
};
