import type { AudioProcessingSettings, NoiseCancellationMode } from "../../types/audioProcessing";
import type { NoiseShieldSnapshot } from "../../types/noiseShield";
import { voiceService } from "../voiceService";
import { noiseCancellationService } from "./noiseCancellationService";

const labels: Record<NoiseCancellationMode, string> = {
  off: "Off",
  standard: "Standard",
  enhanced: "Enhanced",
  "voice-focus": "Voice Focus",
};

function connected(): boolean {
  const status = voiceService.getSnapshot().status;
  return status === "connected" || status === "reconnecting";
}

async function reapplyWhenActive(): Promise<void> {
  const voice = voiceService.getSnapshot();
  if (connected() && !voice.muted) await voiceService.reapplyMicrophoneProcessing();
}

export const noiseShieldControlService = {
  labels,

  async setMode(mode: NoiseCancellationMode): Promise<NoiseShieldSnapshot> {
    noiseCancellationService.requestMode(mode);
    await reapplyWhenActive();
    return noiseCancellationService.getSnapshot();
  },

  async updateSettings(patch: Partial<Omit<AudioProcessingSettings, "noiseCancellationMode">>): Promise<NoiseShieldSnapshot> {
    noiseCancellationService.updateSettings(patch);
    await reapplyWhenActive();
    return noiseCancellationService.getSnapshot();
  },

  async retry(): Promise<NoiseShieldSnapshot> {
    noiseCancellationService.refreshCapabilities();
    await reapplyWhenActive();
    return noiseCancellationService.getSnapshot();
  },

  nextAvailableMode(snapshot = noiseCancellationService.getSnapshot()): NoiseCancellationMode {
    const modes = snapshot.availableModes;
    const current = modes.indexOf(snapshot.requestedMode);
    return modes[(current + 1) % modes.length] ?? "off";
  },

  statusLabel(snapshot = noiseCancellationService.getSnapshot()): string {
    if (snapshot.status === "loading") return "Enhanced filter loading";
    if (snapshot.status === "failed") return snapshot.appliedMode === "standard" ? "Processor failed - Standard active" : "Processor failed";
    if (snapshot.status === "unavailable" || snapshot.status === "unsupported") return "Not supported on this device";
    if (snapshot.status === "fallback" || snapshot.status === "fallback-standard") return snapshot.appliedMode === "standard" ? "Enhanced unavailable - Standard active" : "Standard unavailable - basic microphone active";
    if (snapshot.appliedMode === "voice-focus") return "Voice Focus active";
    if (snapshot.appliedMode === "enhanced") return "Enhanced active";
    if (snapshot.appliedMode === "standard") return "Standard active";
    return "Noise Shield off";
  },
};
