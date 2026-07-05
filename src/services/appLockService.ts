export interface AppLockSettings {
  lockAfterInactivityEnabled: boolean;
  inactivityMinutes: number;
}

const appLockSettingsKey = "picom-app-lock-settings";
const defaults: AppLockSettings = {
  lockAfterInactivityEnabled: false,
  inactivityMinutes: 15,
};

function readStoredSettings(): Partial<AppLockSettings> {
  try {
    return JSON.parse(localStorage.getItem(appLockSettingsKey) ?? "{}") as Partial<AppLockSettings>;
  } catch {
    return {};
  }
}

function normalizeMinutes(value: unknown): number {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return defaults.inactivityMinutes;
  return Math.min(240, Math.max(5, Math.round(minutes)));
}

function persist(settings: AppLockSettings): AppLockSettings {
  localStorage.setItem(appLockSettingsKey, JSON.stringify(settings));
  return settings;
}

export const appLockService = {
  getSettings(): AppLockSettings {
    const stored = readStoredSettings();
    return {
      lockAfterInactivityEnabled: Boolean(stored.lockAfterInactivityEnabled),
      inactivityMinutes: normalizeMinutes(stored.inactivityMinutes),
    };
  },

  updateSettings(partial: Partial<AppLockSettings>): AppLockSettings {
    const current = this.getSettings();
    return persist({
      ...current,
      ...partial,
      inactivityMinutes: normalizeMinutes(partial.inactivityMinutes ?? current.inactivityMinutes),
    });
  },

  reset(): AppLockSettings {
    localStorage.removeItem(appLockSettingsKey);
    return this.getSettings();
  },
};
