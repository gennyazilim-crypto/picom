import { noiseShieldStore } from "../../stores/noiseShieldStore";
import type { AudioProcessingSettings } from "../../types/audioProcessing";
import { normalizeNoiseCancellationMode } from "../../types/audioProcessing";
import type {
  NoiseShieldCapturePlan,
  NoiseShieldMicrophoneConstraints,
  NoiseShieldMode,
  NoiseShieldSnapshot,
} from "../../types/noiseShield";
import { voiceDeviceService } from "../voiceDeviceService";
import { audioCapabilitiesService } from "./audioCapabilitiesService";
import { audioCaptureOptionsService } from "./audioCaptureOptionsService";

const STORAGE_KEY = "picom.noise-shield.settings.v1";
let lastCapturePlan: NoiseShieldCapturePlan | null = null;

function defaultSettings(): AudioProcessingSettings {
  const device = voiceDeviceService.getSnapshot();
  return {
    noiseCancellationMode: "standard",
    echoCancellation: device.echoCancellation,
    autoGainControl: device.autoGainControl,
    preferredInputDeviceId: device.selectedInputId,
    rememberForDevice: true,
  };
}

function readSettings(): AudioProcessingSettings {
  const fallback = defaultSettings();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AudioProcessingSettings> | null;
    if (!parsed) return fallback;
    return {
      noiseCancellationMode: normalizeNoiseCancellationMode(parsed.noiseCancellationMode),
      echoCancellation: typeof parsed.echoCancellation === "boolean" ? parsed.echoCancellation : fallback.echoCancellation,
      autoGainControl: typeof parsed.autoGainControl === "boolean" ? parsed.autoGainControl : fallback.autoGainControl,
      preferredInputDeviceId: typeof parsed.preferredInputDeviceId === "string" ? parsed.preferredInputDeviceId : fallback.preferredInputDeviceId,
      rememberForDevice: parsed.rememberForDevice !== false,
    };
  } catch {
    return fallback;
  }
}

function persist(settings: AudioProcessingSettings): void {
  try {
    if (settings.rememberForDevice) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Restricted storage keeps the current-session preference in memory only.
  }
}

function availableModes(capabilities = audioCapabilitiesService.detect()): readonly NoiseShieldMode[] {
  return capabilities.constraints.noiseSuppression ? ["off", "standard"] : ["off"];
}

function resolveMode(requestedMode: NoiseShieldMode): Pick<NoiseShieldSnapshot, "appliedMode" | "provider" | "status" | "fallbackReason" | "errorCode"> {
  const modes = availableModes();
  if (requestedMode === "off") return { appliedMode: "off", provider: "none", status: "off", fallbackReason: null, errorCode: null };
  if (requestedMode === "standard" && modes.includes("standard")) return { appliedMode: "standard", provider: "chromium_native", status: "requested", fallbackReason: null, errorCode: null };
  if (modes.includes("standard")) {
    return {
      appliedMode: "standard",
      provider: "chromium_native",
      status: "fallback",
      fallbackReason: `${requestedMode === "voice-focus" ? "Voice Focus" : "Enhanced"} is unavailable. Standard mode is used instead.`,
      errorCode: "PROCESSOR_PACKAGE_UNAVAILABLE",
    };
  }
  return {
    appliedMode: "off",
    provider: "none",
    status: "unavailable",
    fallbackReason: "This runtime does not expose native microphone noise suppression.",
    errorCode: "MEDIA_UNSUPPORTED",
  };
}

const initialSettings = readSettings();
const initialCapabilities = audioCapabilitiesService.detect();
noiseShieldStore.patch({
  settings: initialSettings,
  capabilities: initialCapabilities,
  requestedMode: initialSettings.noiseCancellationMode,
  availableModes: availableModes(initialCapabilities),
});

export const noiseCancellationService = {
  store: noiseShieldStore,
  getSnapshot: noiseShieldStore.getSnapshot,
  subscribe: noiseShieldStore.subscribe,

  refreshCapabilities(): NoiseShieldSnapshot {
    const capabilities = audioCapabilitiesService.detect();
    return noiseShieldStore.patch({ capabilities, availableModes: availableModes(capabilities) });
  },

  activateVoice(roomId: string): NoiseShieldSnapshot {
    return this.activate("voice", roomId, noiseShieldStore.getSnapshot().settings.noiseCancellationMode);
  },

  activateMeeting(roomId: string, requestedMode: NoiseShieldMode): NoiseShieldSnapshot {
    return this.activate("meeting", roomId, requestedMode);
  },

  activate(scope: "voice" | "meeting", roomId: string, requestedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const capabilities = audioCapabilitiesService.detect();
    const mode = normalizeNoiseCancellationMode(requestedMode);
    const settings = { ...noiseShieldStore.getSnapshot().settings, noiseCancellationMode: mode };
    persist(settings);
    return noiseShieldStore.patch({
      scope,
      roomId,
      settings,
      capabilities,
      requestedMode: mode,
      availableModes: availableModes(capabilities),
      ...resolveMode(mode),
      application: null,
      lastAppliedAt: null,
    });
  },

  requestMode(requestedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const mode = normalizeNoiseCancellationMode(requestedMode);
    const current = noiseShieldStore.getSnapshot();
    const settings = { ...current.settings, noiseCancellationMode: mode };
    persist(settings);
    return noiseShieldStore.patch({ settings, requestedMode: mode, ...resolveMode(mode), application: null });
  },

  updateSettings(patch: Partial<Omit<AudioProcessingSettings, "noiseCancellationMode">>): NoiseShieldSnapshot {
    const current = noiseShieldStore.getSnapshot();
    const settings: AudioProcessingSettings = { ...current.settings, ...patch };
    persist(settings);
    voiceDeviceService.updateProcessingOptions({ echoCancellation: settings.echoCancellation, autoGainControl: settings.autoGainControl });
    return noiseShieldStore.patch({ settings });
  },

  createMicrophoneCapturePlan(base: NoiseShieldMicrophoneConstraints): NoiseShieldCapturePlan {
    const current = this.refreshCapabilities();
    const settings: AudioProcessingSettings = {
      ...current.settings,
      echoCancellation: typeof base.echoCancellation === "boolean" ? base.echoCancellation : current.settings.echoCancellation,
      autoGainControl: typeof base.autoGainControl === "boolean" ? base.autoGainControl : current.settings.autoGainControl,
      preferredInputDeviceId: current.settings.preferredInputDeviceId,
    };
    const plan = audioCaptureOptionsService.createPlan(base, settings, current.capabilities);
    lastCapturePlan = { ...plan, provider: plan.appliedMode === "standard" ? "chromium_native" : "none" };
    if (plan.fallbackReason) {
      noiseShieldStore.patch({
        appliedMode: plan.appliedMode,
        provider: plan.appliedMode === "standard" ? "chromium_native" : "none",
        status: plan.appliedMode === "standard" ? "fallback" : "unavailable",
        fallbackReason: plan.fallbackReason,
        errorCode: plan.appliedMode === "standard" ? "PROCESSOR_PACKAGE_UNAVAILABLE" : "MEDIA_UNSUPPORTED",
      });
    }
    return lastCapturePlan;
  },

  createBasicFallback(base: NoiseShieldMicrophoneConstraints): NoiseShieldMicrophoneConstraints {
    return audioCaptureOptionsService.createBasicFallback(base, noiseShieldStore.getSnapshot().capabilities);
  },

  verifyAppliedTrack(track: MediaStreamTrack | null | undefined, plan: NoiseShieldCapturePlan | null = lastCapturePlan): NoiseShieldSnapshot {
    const current = noiseShieldStore.getSnapshot();
    const applied = audioCapabilitiesService.inspectTrack(track);
    if (!plan) return this.markFailed("Noise Shield capture plan was not available for verification.", "STANDARD_PARTIAL");

    if (plan.requestedMode === "off") {
      const verified = applied.noiseSuppression === false || (!current.capabilities.constraints.noiseSuppression && applied.noiseSuppression === null);
      const fallbackReason = verified ? null : "The runtime did not confirm that native noise suppression is disabled.";
      const application = { requested: plan.requested, supported: plan.supported, applied, verified, fallbackReason };
      return noiseShieldStore.patch({ appliedMode: "off", provider: "none", status: "off", fallbackReason, errorCode: verified ? null : "STANDARD_PARTIAL", application, appliedSettings: applied, lastAppliedAt: new Date().toISOString() });
    }

    const verified = applied.noiseSuppression === true;
    const unknown = applied.noiseSuppression === null;
    const fallbackReason = verified ? plan.fallbackReason : unknown
      ? "The microphone is active, but this runtime did not report the applied noise-suppression setting."
      : "The microphone is active without confirmed native noise suppression.";
    const application = { requested: plan.requested, supported: plan.supported, applied, verified, fallbackReason };
    return noiseShieldStore.patch({
      appliedMode: verified ? "standard" : "off",
      provider: verified ? "chromium_native" : "none",
      status: verified && !plan.fallbackReason ? "applied" : "fallback",
      fallbackReason,
      errorCode: verified && !plan.fallbackReason ? null : "STANDARD_PARTIAL",
      application,
      appliedSettings: applied,
      lastAppliedAt: new Date().toISOString(),
    });
  },

  markApplied(appliedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const current = noiseShieldStore.getSnapshot();
    const fallback = current.requestedMode !== appliedMode;
    return noiseShieldStore.patch({ appliedMode, provider: appliedMode === "standard" ? "chromium_native" : "none", status: appliedMode === "off" ? "off" : fallback ? "fallback" : "applied", fallbackReason: fallback ? current.fallbackReason ?? `Requested ${current.requestedMode} is unavailable.` : null, errorCode: fallback ? "STANDARD_PARTIAL" : null, lastAppliedAt: new Date().toISOString() });
  },

  markFallback(reason: string): NoiseShieldSnapshot {
    return noiseShieldStore.patch({ appliedMode: "off", provider: "none", status: "fallback", fallbackReason: reason, errorCode: "STANDARD_PARTIAL", lastAppliedAt: new Date().toISOString() });
  },

  markFailed(reason: string, errorCode: NoiseShieldSnapshot["errorCode"] = "STANDARD_PARTIAL"): NoiseShieldSnapshot {
    return noiseShieldStore.patch({ appliedMode: "off", provider: "none", status: "failed", fallbackReason: reason, errorCode, lastAppliedAt: null });
  },

  deactivateSession(): NoiseShieldSnapshot {
    lastCapturePlan = null;
    return noiseShieldStore.reset();
  },

  deactivateMeeting(): NoiseShieldSnapshot {
    return this.deactivateSession();
  },

  diagnostics() {
    const state = noiseShieldStore.getSnapshot();
    return {
      requestedMode: state.requestedMode,
      appliedMode: state.appliedMode,
      provider: state.provider,
      status: state.status,
      supportedConstraints: state.capabilities.constraints,
      appliedSettings: state.appliedSettings,
      verified: state.application?.verified ?? false,
      fallbackReason: state.fallbackReason,
      errorCode: state.errorCode,
    } as const;
  },
};
