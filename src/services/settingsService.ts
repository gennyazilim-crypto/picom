export type ThemeMode = "light" | "dark";
export interface NotificationSettings { enabled: boolean; muted: boolean; mentionsOnly: boolean; }
export interface ProfileSettings { displayName: string; statusText: string; bio: string; }
export interface AccessibilitySettings { highContrast: boolean; reducedMotion: boolean; largerText: boolean; focusRingStrong: boolean; }
export interface PicomSettings { theme: ThemeMode; notificationSettings: NotificationSettings; profileSettings: ProfileSettings; accessibilitySettings: AccessibilitySettings; }
const key = "picom-settings";
const defaults: PicomSettings = {
  theme: "light",
  notificationSettings: { enabled: true, muted: false, mentionsOnly: false },
  profileSettings: { displayName: "", statusText: "", bio: "" },
  accessibilitySettings: { highContrast: false, reducedMotion: false, largerText: false, focusRingStrong: false },
};
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
        profileSettings: {
          ...defaults.profileSettings,
          ...(parsed.profileSettings ?? {}),
        },
        accessibilitySettings: {
          ...defaults.accessibilitySettings,
          ...(parsed.accessibilitySettings ?? {}),
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
  updateProfileSettings(partial: Partial<ProfileSettings>) {
    const current = this.getSettings();
    return this.updateSettings({
      profileSettings: {
        ...current.profileSettings,
        ...partial,
      },
    });
  },
  updateAccessibilitySettings(partial: Partial<AccessibilitySettings>) {
    const current = this.getSettings();
    return this.updateSettings({
      accessibilitySettings: {
        ...current.accessibilitySettings,
        ...partial,
      },
    });
  },
  resetSettings() { localStorage.removeItem(key); return defaults; }
};
