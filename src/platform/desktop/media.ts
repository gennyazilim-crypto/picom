import type { MediaPermissionAdapter } from "../types";
import { unavailable } from "./unavailable";

export const desktopMedia: MediaPermissionAdapter = {
  async queryMicrophone() {
    return "unknown";
  },
  async queryCamera() {
    return "unknown";
  },
  async getUserMedia(constraints) {
    try {
      return { ok: true, data: await navigator.mediaDevices.getUserMedia(constraints) };
    } catch {
      return unavailable("Media permission denied.");
    }
  },
};
