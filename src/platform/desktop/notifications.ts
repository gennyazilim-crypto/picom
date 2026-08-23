import type { NotificationAdapter } from "../types";
import { unavailable } from "./unavailable";

export const desktopNotifications: NotificationAdapter = {
  isAvailable: () => Boolean(window.picomDesktop?.showNotification),
  async requestPermission() {
    return "granted";
  },
  async show(input) {
    const show = window.picomDesktop?.showNotification;
    if (!show) return unavailable("Desktop notifications are unavailable.");
    const result = await show({ title: input.title, body: input.body ?? "", silent: false, tag: input.tag });
    return result.ok ? { ok: true, data: true } : unavailable(result.error ?? "Notification failed.");
  },
};
