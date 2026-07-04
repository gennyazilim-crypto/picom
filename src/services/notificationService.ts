export const notificationService = {
  async showTestNotification() {
    if (!("Notification" in window)) return { ok: false, reason: "Native notifications unavailable in this runtime." };
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return { ok: false, reason: "Notification permission was not granted." };
    new Notification("Picom", { body: "Desktop notification placeholder is working." });
    return { ok: true };
  }
};