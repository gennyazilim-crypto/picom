import type {
  AppliedAudioProcessingSettings,
  AudioCaptureConstraints,
  AudioProcessingCapabilities,
  AudioProcessingCapturePlan,
  AudioProcessingSettings,
} from "../../types/audioProcessing";

function requestedSettings(settings: AudioProcessingSettings): AppliedAudioProcessingSettings {
  return {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseCancellationMode !== "off",
    autoGainControl: settings.autoGainControl,
    deviceIdApplied: settings.preferredInputDeviceId ? true : null,
  };
}

export const audioCaptureOptionsService = {
  createPlan(
    base: AudioCaptureConstraints,
    settings: AudioProcessingSettings,
    capabilities: AudioProcessingCapabilities,
  ): AudioProcessingCapturePlan {
    const constraints: AudioCaptureConstraints = { ...base };
    const requested = requestedSettings(settings);

    if (settings.preferredInputDeviceId && settings.preferredInputDeviceId !== "default" && constraints.deviceId === undefined && capabilities.constraints.deviceId) {
      constraints.deviceId = { ideal: settings.preferredInputDeviceId };
    }
    if (capabilities.constraints.echoCancellation) constraints.echoCancellation = settings.echoCancellation;
    else delete constraints.echoCancellation;
    if (capabilities.constraints.autoGainControl) constraints.autoGainControl = settings.autoGainControl;
    else delete constraints.autoGainControl;

    if (capabilities.constraints.noiseSuppression) constraints.noiseSuppression = settings.noiseCancellationMode !== "off";
    else delete constraints.noiseSuppression;

    const wantsProcessing = settings.noiseCancellationMode !== "off";
    const standardAvailable = capabilities.constraints.noiseSuppression;
    const appliedMode = wantsProcessing && standardAvailable ? "standard" : "off";
    const fallbackReason = wantsProcessing && !standardAvailable
      ? "This runtime does not expose native microphone noise suppression. Basic microphone audio remains available."
      : settings.noiseCancellationMode === "enhanced" || settings.noiseCancellationMode === "voice-focus"
        ? `${settings.noiseCancellationMode === "voice-focus" ? "Voice Focus" : "Enhanced"} is not available from this build. Standard mode is used instead.`
        : null;

    return {
      constraints,
      requestedMode: settings.noiseCancellationMode,
      appliedMode,
      requested,
      supported: capabilities.constraints,
      fallbackReason,
    };
  },

  createBasicFallback(base: AudioCaptureConstraints, capabilities: AudioProcessingCapabilities): AudioCaptureConstraints {
    const fallback = { ...base };
    if (capabilities.constraints.noiseSuppression) fallback.noiseSuppression = false;
    else delete fallback.noiseSuppression;
    return fallback;
  },
};
