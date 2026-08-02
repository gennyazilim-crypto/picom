import type { NotificationAdapter } from "../types";
import { desktopOnly, unavailable } from "./unsupported";

export const webNotifications: NotificationAdapter = {
  isAvailable: () => typeof Notification !== "undefined",
  async requestPermission() {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission !== "default") return Notification.permission;
    return Notification.requestPermission();
  },
  async show(input) {
    if (typeof Notification === "undefined") {
      return desktopOnly("Notifications");
    }
    if (Notification.permission !== "granted") {
      return unavailable("PERMISSION_DENIED", "Notification permission was not granted.");
    }
    new Notification(input.title, { body: input.body, tag: input.tag });
    return { ok: true, data: true };
  },
};
