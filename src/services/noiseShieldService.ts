import { noiseShieldStore } from "../stores/noiseShieldStore";
import type { NoiseShieldCapturePlan, NoiseShieldMicrophoneConstraints, NoiseShieldMode, NoiseShieldSnapshot } from "../types/noiseShield";

function capabilities(): { availableModes: readonly NoiseShieldMode[]; standard: boolean; echoCancellation: boolean; autoGainControl: boolean } {
  const supported = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getSupportedConstraints === "function" ? navigator.mediaDevices.getSupportedConstraints() : {};
  const standard = supported.noiseSuppression === true;
  return { availableModes: standard ? ["off", "standard"] : ["off"], standard, echoCancellation: supported.echoCancellation === true, autoGainControl: supported.autoGainControl === true };
}

function resolveMode(requestedMode: NoiseShieldMode): { appliedMode: NoiseShieldMode; fallbackReason: string | null } {
  const support = capabilities();
  if (requestedMode === "off") return { appliedMode: "off", fallbackReason: null };
  if (requestedMode === "standard" && support.standard) return { appliedMode: "standard", fallbackReason: null };
  if (support.standard) return { appliedMode: "standard", fallbackReason: `${requestedMode.replace("_", " ")} is not provided by this build. Standard mode is used instead.` };
  return { appliedMode: "off", fallbackReason: "This runtime does not expose native microphone noise suppression." };
}

export const noiseShieldService = {
  store: noiseShieldStore,
  getSnapshot: noiseShieldStore.getSnapshot,
  subscribe: noiseShieldStore.subscribe,
  activateMeeting(roomId: string, requestedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const support = capabilities(), resolved = resolveMode(requestedMode);
    return noiseShieldStore.patch({ scope: "meeting", roomId, requestedMode, appliedMode: resolved.appliedMode, availableModes: support.availableModes, provider: resolved.appliedMode === "standard" ? "chromium_native" : "none", status: requestedMode === "off" ? "off" : resolved.appliedMode === "off" ? "unavailable" : resolved.fallbackReason ? "fallback" : "requested", fallbackReason: resolved.fallbackReason, lastAppliedAt: null });
  },
  requestMode(requestedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const current = noiseShieldStore.getSnapshot(), support = capabilities(), resolved = resolveMode(requestedMode);
    return noiseShieldStore.patch({ requestedMode, appliedMode: resolved.appliedMode, availableModes: support.availableModes, provider: resolved.appliedMode === "standard" ? "chromium_native" : "none", status: requestedMode === "off" ? "off" : resolved.appliedMode === "off" ? "unavailable" : resolved.fallbackReason ? "fallback" : "requested", fallbackReason: resolved.fallbackReason, lastAppliedAt: requestedMode === "off" ? null : current.lastAppliedAt });
  },
  createMicrophoneCapturePlan(base: NoiseShieldMicrophoneConstraints): NoiseShieldCapturePlan {
    const current = noiseShieldStore.getSnapshot(), support = capabilities();
    if (current.scope !== "meeting" || current.appliedMode === "off") return { constraints: { ...base }, requestedMode: current.requestedMode, appliedMode: "off", provider: "none" };
    const constraints: NoiseShieldMicrophoneConstraints = { ...base, noiseSuppression: true };
    if (support.echoCancellation) constraints.echoCancellation = true;
    if (support.autoGainControl) constraints.autoGainControl = true;
    return { constraints, requestedMode: current.requestedMode, appliedMode: "standard", provider: "chromium_native" };
  },
  markApplied(appliedMode: NoiseShieldMode): NoiseShieldSnapshot {
    const current = noiseShieldStore.getSnapshot(), fallback = current.requestedMode !== appliedMode;
    return noiseShieldStore.patch({ appliedMode, provider: appliedMode === "standard" ? "chromium_native" : "none", status: appliedMode === "off" ? "off" : fallback ? "fallback" : "applied", fallbackReason: fallback ? current.fallbackReason ?? `Requested ${current.requestedMode} is unavailable.` : null, lastAppliedAt: appliedMode === "off" ? null : new Date().toISOString() });
  },
  markFallback(reason: string): NoiseShieldSnapshot { return noiseShieldStore.patch({ appliedMode: "off", provider: "none", status: "fallback", fallbackReason: reason, lastAppliedAt: null }); },
  markFailed(reason: string): NoiseShieldSnapshot { return noiseShieldStore.patch({ appliedMode: "off", provider: "none", status: "failed", fallbackReason: reason, lastAppliedAt: null }); },
  deactivateMeeting(): NoiseShieldSnapshot { return noiseShieldStore.reset(); },
  diagnostics(): Readonly<{ requestedMode: NoiseShieldMode; appliedMode: NoiseShieldMode; provider: string; status: string; fallback: boolean }> { const state = noiseShieldStore.getSnapshot(); return { requestedMode: state.requestedMode, appliedMode: state.appliedMode, provider: state.provider, status: state.status, fallback: Boolean(state.fallbackReason) }; },
};
