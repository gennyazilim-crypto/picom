export type ThemeMode = "light" | "dark";
export interface NotificationSettings { enabled: boolean; muted: boolean; }
export interface PicomSettings { theme: ThemeMode; notificationSettings: NotificationSettings; }
const key = "picom-settings";
const defaults: PicomSettings = { theme: "light", notificationSettings: { enabled: true, muted: false } };
export const settingsService = {
  getSettings(): PicomSettings {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) ?? "{}") }; } catch { return defaults; }
  },
  updateSettings(partial: Partial<PicomSettings>) {
    const next = { ...this.getSettings(), ...partial };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  },
  resetSettings() { localStorage.removeItem(key); return defaults; }
};