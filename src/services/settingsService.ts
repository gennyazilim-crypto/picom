export type ThemeMode = "light" | "dark";
export interface NotificationSettings { enabled: boolean; muted: boolean; mentionsOnly: boolean; }
export interface PicomSettings { theme: ThemeMode; notificationSettings: NotificationSettings; }
const key = "picom-settings";
const defaults: PicomSettings = { theme: "light", notificationSettings: { enabled: true, muted: false, mentionsOnly: false } };
export const settingsService = {
  getSettings(): PicomSettings {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<PicomSettings>;
      return {
        ...defaults,
        ...parsed,
        notificationSettings: {
          ...defaults.notificationSettings,
          ...(parsed.notificationSettings ?? {}),
        },
      };
    } catch { return defaults; }
  },
  updateSettings(partial: Partial<PicomSettings>) {
    const next = { ...this.getSettings(), ...partial };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  },
  updateNotificationSettings(partial: Partial<NotificationSettings>) {
    const current = this.getSettings();
    return this.updateSettings({
      notificationSettings: {
        ...current.notificationSettings,
        ...partial,
      },
    });
  },
  resetSettings() { localStorage.removeItem(key); return defaults; }
};
