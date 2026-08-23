import type { ScreenShareAdapter } from "../types";
import { unavailable } from "./unsupported";

const BROWSER_DISPLAY_SOURCE = {
  id: "browser:display",
  name: "Windows screen & window picker",
  type: "screen" as const,
};

export const webScreenShare: ScreenShareAdapter = {
  mode:
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function"
      ? "browser"
      : "unavailable",
  async listSources() {
    if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
      return unavailable("UNAVAILABLE", "Screen sharing is not supported in this browser.");
    }
    return { ok: true, data: [BROWSER_DISPLAY_SOURCE] };
  },
  async acquireDisplayMedia(constraints) {
    if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
      return unavailable("UNAVAILABLE", "Screen sharing is not supported in this browser.");
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(
        constraints ?? {
          video: { frameRate: 30, width: { max: 1920 }, height: { max: 1080 } },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        },
      );
      return { ok: true, data: stream };
    } catch {
      return unavailable("CANCELLED", "Screen share was cancelled or blocked.");
    }
  },
};
