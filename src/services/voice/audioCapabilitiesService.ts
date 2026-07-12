import type {
  AppliedAudioProcessingSettings,
  AudioProcessingCapabilities,
} from "../../types/audioProcessing";

function supportedConstraints(): MediaTrackSupportedConstraints {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getSupportedConstraints !== "function") return {};
  try {
    return navigator.mediaDevices.getSupportedConstraints();
  } catch {
    return {};
  }
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export const audioCapabilitiesService = {
  detect(): AudioProcessingCapabilities {
    const supported = supportedConstraints();
    return {
      mediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
      constraints: {
        deviceId: supported.deviceId === true,
        echoCancellation: supported.echoCancellation === true,
        noiseSuppression: supported.noiseSuppression === true,
        autoGainControl: supported.autoGainControl === true,
      },
      trackSettings: typeof MediaStreamTrack !== "undefined" && typeof MediaStreamTrack.prototype.getSettings === "function",
      audioWorklet: typeof AudioWorkletNode !== "undefined",
      webAssembly: typeof WebAssembly !== "undefined",
      enhancedProvider: false,
      voiceFocusProvider: false,
    };
  },

  inspectTrack(track: MediaStreamTrack | null | undefined): AppliedAudioProcessingSettings {
    if (!track || typeof track.getSettings !== "function") {
      return { echoCancellation: null, noiseSuppression: null, autoGainControl: null, deviceIdApplied: null };
    }
    try {
      const settings = track.getSettings();
      return {
        echoCancellation: nullableBoolean(settings.echoCancellation),
        noiseSuppression: nullableBoolean(settings.noiseSuppression),
        autoGainControl: nullableBoolean(settings.autoGainControl),
        deviceIdApplied: typeof settings.deviceId === "string" ? settings.deviceId.length > 0 : null,
      };
    } catch {
      return { echoCancellation: null, noiseSuppression: null, autoGainControl: null, deviceIdApplied: null };
    }
  },
};
