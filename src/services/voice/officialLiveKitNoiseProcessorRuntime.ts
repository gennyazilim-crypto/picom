import type { EnhancedNoiseProviderLoadResult } from "./enhancedNoiseProcessorTypes";

/**
 * Lazy runtime boundary for LiveKit's official @livekit/krisp-noise-filter package.
 * The audited Picom dependency graph does not include that optional package, so
 * this build must fail closed and retain Standard WebRTC processing.
 */
export async function loadOfficialLiveKitNoiseProcessor(): Promise<EnhancedNoiseProviderLoadResult> {
  return {
    ok: false,
    code: "PROCESSOR_PACKAGE_UNAVAILABLE",
    reason: "Enhanced Noise Shield is not installed for this build. Standard mode remains active.",
  };
}
