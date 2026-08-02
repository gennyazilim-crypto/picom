import type { MediaPermissionAdapter } from "../types";
import { unavailable } from "./unsupported";

export const webMedia: MediaPermissionAdapter = {
  async queryMicrophone() {
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return status.state;
    } catch {
      return "unknown";
    }
  },
  async queryCamera() {
    try {
      const status = await navigator.permissions.query({ name: "camera" as PermissionName });
      return status.state;
    } catch {
      return "unknown";
    }
  },
  async getUserMedia(constraints) {
    try {
      return { ok: true, data: await navigator.mediaDevices.getUserMedia(constraints) };
    } catch {
      return unavailable("MEDIA_DENIED", "Camera or microphone permission was denied.");
    }
  },
};
