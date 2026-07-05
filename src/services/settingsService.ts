export type ThemeMode = "light" | "dark";
import type { NotificationDigestMode } from "./notificationDigestService";
export type QuietHoursApplyMode = "all_notifications" | "normal_messages_only" | "sounds_only_placeholder";
export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  applyTo: QuietHoursApplyMode;
  allowMentions: boolean;
}
export interface NotificationSettings {
  enabled: boolean;
  muted: boolean;
  mentionsOnly: boolean;
  digestMode: NotificationDigestMode;
  quietHours: QuietHoursSettings;
}
export interface ProfileSettings { displayName: string; statusText: string; bio: string; }
export interface AccessibilitySettings { highContrast: boolean; reducedMotion: boolean; largerText: boolean; focusRingStrong: boolean; }
export interface PicomSettings { schemaVersion: number; theme: ThemeMode; notificationSettings: NotificationSettings; profileSettings: ProfileSettings; accessibilitySettings: AccessibilitySettings; }
type StoredPicomSettings = Partial<PicomSettings> & Record<string, unknown>;
type LocalSettingsMigration = {
  fromVersion: number;
  toVersion: number;
  migrate: (settings: StoredPicomSettings) => StoredPicomSettings;
};

const key = "picom-settings";
const backupKeyPrefix = "picom-settings.backup";
const currentSchemaVersion = 2;
const defaults: PicomSettings = {
  schemaVersion: currentSchemaVersion,
  theme: "light",
  notificationSettings: {
    enabled: true,
    muted: false,
    mentionsOnly: false,
    digestMode: "off",
    quietHours: {
      enabled: false,
      startTime: "22:00",
      endTime: "07:00",
      applyTo: "normal_messages_only",
      allowMentions: true,
    },
  },
  profileSettings: { displayName: "", statusText: "", bio: "" },
  accessibilitySettings: { highContrast: false, reducedMotion: false, largerText: false, focusRingStrong: false },
};

export const localSettingsMigrations: LocalSettingsMigration[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 1,
    }),
  },
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 2,
      accessibilitySettings: {
        ...defaults.accessibilitySettings,
        ...(typeof settings.accessibilitySettings === "object" && settings.accessibilitySettings ? settings.accessibilitySettings : {}),
      },
    }),
  },
];

function getStoredSchemaVersion(settings: StoredPicomSettings): number {
  return typeof settings.schemaVersion === "number" && Number.isFinite(settings.schemaVersion) ? settings.schemaVersion : 0;
}

function normalizeSettings(settings: StoredPicomSettings): PicomSettings {
  return {
    ...defaults,
    ...settings,
    schemaVersion: currentSchemaVersion,
    theme: settings.theme === "dark" ? "dark" : "light",
    notificationSettings: {
      ...defaults.notificationSettings,
      ...(settings.notificationSettings ?? {}),
      quietHours: {
        ...defaults.notificationSettings.quietHours,
        ...((settings.notificationSettings as Partial<NotificationSettings> | undefined)?.quietHours ?? {}),
      },
    },
    profileSettings: {
      ...defaults.profileSettings,
      ...(settings.profileSettings ?? {}),
    },
    accessibilitySettings: {
      ...defaults.accessibilitySettings,
      ...(settings.accessibilitySettings ?? {}),
    },
  };
}

function migrateSettings(settings: StoredPicomSettings): PicomSettings {
  let working: StoredPicomSettings = { ...settings };
  let version = getStoredSchemaVersion(working);

  while (version < currentSchemaVersion) {
    const migration = localSettingsMigrations.find((candidate) => candidate.fromVersion === version);
    if (!migration) {
      return defaults;
    }

    working = migration.migrate(working);
    version = migration.toVersion;
  }

  if (version > currentSchemaVersion) {
    return defaults;
  }

  return normalizeSettings(working);
}

function backupInvalidSettings(raw: string): void {
  try {
    localStorage.setItem(`${backupKeyPrefix}.${Date.now()}`, raw.slice(0, 12_000));
    localStorage.setItem("picom:safe-mode:forced", "true");
    localStorage.setItem("picom:safe-mode:reason", "corrupted_settings_placeholder");
    localStorage.removeItem(key);
  } catch {
    // If localStorage is unavailable, fall back to safe defaults without blocking startup.
  }
}

function writeSettings(next: PicomSettings): void {
  localStorage.setItem(key, JSON.stringify(next));
}

export const settingsService = {
  getDefaultSettings(): PicomSettings {
    return {
      ...defaults,
      notificationSettings: { ...defaults.notificationSettings },
      profileSettings: { ...defaults.profileSettings },
      accessibilitySettings: { ...defaults.accessibilitySettings },
    };
  },
  getSettings(): PicomSettings {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;

    try {
      const parsed = JSON.parse(raw) as StoredPicomSettings;
      const next = migrateSettings(parsed);
      if (JSON.stringify(next) !== raw) {
        writeSettings(next);
      }
      return next;
    } catch {
      backupInvalidSettings(raw);
      return defaults;
    }
  },
  updateSettings(partial: Partial<PicomSettings>) {
    const next = normalizeSettings({ ...this.getSettings(), ...partial, schemaVersion: currentSchemaVersion });
    writeSettings(next);
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
