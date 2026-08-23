import type { ProfileStatus } from "../types/profile";
import type { Json } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { normalizeUiLanguage, resolveSystemUiLanguage, type UiLanguage } from "./localization/uiLanguages";
import {
  completeFirstLaunchSetupState,
  createFirstLaunchSetupState,
  normalizeFirstLaunchSetupState,
  skipFirstLaunchSetupStep as applyFirstLaunchSetupSkip,
  updateFirstLaunchSetupState as applyFirstLaunchSetupPatch,
  type FirstLaunchOptionalStepId,
  type FirstLaunchSetupState,
  type FirstLaunchSetupStatePatch,
} from "./firstLaunchSetupState";
import { commitFirstLaunchCompletion } from "./firstLaunchCompletion";
import {
  getAppearanceStudioDefaults,
  normalizeAccessibilitySettings,
  type InterfaceScale,
  type TextSize,
} from "./appearanceStudioPreferences";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export type { UiLanguage };
export type { InterfaceScale, TextSize } from "./appearanceStudioPreferences";
export type DesktopDensity = "comfortable" | "compact";
export type DateStylePreference = "system" | "numeric" | "descriptive";
export type TimeFormatPreference = "system" | "12h" | "24h";
/**
 * "system": language is re-resolved from the OS/browser locale on every settings read
 * (falls back to English when unsupported). "manual": the user's explicit choice is pinned
 * and never overridden by OS locale changes.
 */
export type LanguageMode = "system" | "manual";
import type { NotificationDigestMode } from "./notificationDigestService";
import { isV1FeatureEnabled } from "../config/v1ReleaseScope";
import {
  composeNotificationSettings,
  mergeRemoteNotificationSettings,
  splitNotificationOwnership,
  toSyncedNotificationPayload,
} from "./settings/notificationOwnership";
const allSettingsSections = [
  "Account",
  "Profile",
  "Privacy & Safety",
  "Appearance",
  "Language & Region",
  "Notifications",
  "Voice & Video",
  "Companion",
  "Keyboard Shortcuts",
  "Windows & Startup",
  "Storage",
  "Update",
  "Diagnostics",
  "Admin Operations",
  "Legal",
  "Advanced",
] as const;
export type SettingsSection = typeof allSettingsSections[number];
export const settingsSections: readonly SettingsSection[] = allSettingsSections.filter((section) => {
  if (section === "Voice & Video") return isV1FeatureEnabled("voiceRooms") || isV1FeatureEnabled("screenShare");
  return true;
});
export type SettingsPersistenceScope =
  | "local-device"
  | "main-process-device"
  | "user-account-synced"
  | "account-center"
  | "community-specific"
  | "server-controlled";
/**
 * Source-of-truth registry for Settings surfaces.
 * - local-device / main-process-device: never store secrets; device UX only
 * - user-account-synced: Supabase `user_settings` (theme_mode + notification_settings)
 * - account-center: password / MFA / sessions / providers / delete — never duplicated in Desktop forms
 */
export const settingsPersistenceRegistry = {
  theme: "local-device",
  firstLaunchSetupCompleted: "local-device",
  /** Device-only draft; intentionally never keyed or synced by account identity. */
  firstLaunchSetup: "local-device",
  accessibilitySettings: "local-device",
  appearanceSettings: "user-account-synced",
  /** Category prefs only — see notificationOwnership.ts for device vs synced split. */
  notificationSettingsSynced: "user-account-synced",
  notificationSettingsDevice: "main-process-device",
  profileSettings: "user-account-synced",
  selectedDevices: "main-process-device",
  windowStartup: "main-process-device",
  shortcuts: "local-device",
  passwordMfaSessionsProviders: "account-center",
  communityNotificationPolicy: "community-specific",
  featureFlags: "server-controlled",
  updatePolicy: "server-controlled",
} as const satisfies Record<string, SettingsPersistenceScope>;

/** Nav groups for the production Settings shell (grouped nav, not a dense column clone). */
export const settingsNavGroups: readonly Readonly<{
  id: string;
  labelEn: string;
  labelTr: string;
  sections: readonly SettingsSection[];
}>[] = [
  { id: "account", labelEn: "Account", labelTr: "Hesap", sections: ["Account", "Profile"] },
  {
    id: "preferences",
    labelEn: "Preferences",
    labelTr: "Tercihler",
    sections: ["Appearance", "Language & Region", "Notifications", "Privacy & Safety"],
  },
  {
    id: "media",
    labelEn: "Media",
    labelTr: "Medya",
    sections: ["Voice & Video", "Companion"],
  },
  {
    id: "system",
    labelEn: "System",
    labelTr: "Sistem",
    sections: ["Keyboard Shortcuts", "Windows & Startup", "Storage", "Update", "Diagnostics"],
  },
  { id: "more", labelEn: "More", labelTr: "Diğer", sections: ["Legal", "Advanced", "Admin Operations"] },
];
export type QuietHoursApplyMode = "all_notifications" | "normal_messages_only" | "sounds_only";
export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  applyTo: QuietHoursApplyMode;
  allowMentions: boolean;
}
export interface NotificationSettings {
  enabled: boolean;
  /** Device-local delivery (main-process / local SoT). */
  nativeDesktopEnabled: boolean;
  /** Device-local delivery (main-process / local SoT). */
  soundEnabled: boolean;
  muted: boolean;
  mentionsOnly: boolean;
  mentions: boolean;
  replies: boolean;
  reactions: boolean;
  directMessages: boolean;
  communityAnnouncements: boolean;
  friendRequests: boolean;
  friendAcceptances: boolean;
  radioLive: boolean;
  radioReminders: boolean;
  podcastReleases: boolean;
  eventReminders: boolean;
  incomingCalls: boolean;
  missedCalls: boolean;
  /** Policy-locked: always true; UI must not offer a working off toggle. */
  securityAlerts: boolean;
  productAnnouncements: boolean;
  allowMentionsFromMutedScopes: boolean;
  digestMode: NotificationDigestMode;
  /** Device-local quiet hours behavior. */
  quietHours: QuietHoursSettings;
  notifyWhileFocused: boolean;
  taskbarFlash: boolean;
  trayBadge: boolean;
  titlebarBadge: boolean;
}
export interface ProfileSettings {
  displayName: string;
  username: string;
  status: ProfileStatus;
  statusText: string;
  bio: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  location: string;
  timezone: string;
  preferredLanguage: string;
  tags: string[];
}
export interface AccessibilitySettings { highContrast: boolean; reducedMotion: boolean; textSize: TextSize; interfaceScale: InterfaceScale; focusRingStrong: boolean; }
export interface AppearanceSettings { themeMode: ThemePreference; language: UiLanguage; languageMode: LanguageMode; density: DesktopDensity; dateStyle: DateStylePreference; timeFormat: TimeFormatPreference; }
export interface PicomSettings { schemaVersion: number; theme: ThemeMode; firstLaunchSetupCompleted: boolean; firstLaunchSetup: FirstLaunchSetupState; notificationSettings: NotificationSettings; profileSettings: ProfileSettings; accessibilitySettings: AccessibilitySettings; appearanceSettings: AppearanceSettings; }
type StoredPicomSettings = Partial<PicomSettings> & Record<string, unknown>;
type LocalSettingsMigration = {
  fromVersion: number;
  toVersion: number;
  migrate: (settings: StoredPicomSettings) => StoredPicomSettings;
};

const key = "picom-settings";
const backupKeyPrefix = "picom-settings.backup";
const initialSectionKey = "picom:settings:initial-section";
const initialFocusKey = "picom:settings:initial-focus";
export type SettingsFocusTarget = "voice-microphone" | "voice-output";
const currentSchemaVersion = 14;
const listeners = new Set<(settings: PicomSettings) => void>();
let cachedSettings: PicomSettings | null = null;
const defaultNotificationSettings = (): NotificationSettings => {
  const split = splitNotificationOwnership({});
  return composeNotificationSettings(split.device, split.synced);
};
const defaults: PicomSettings = {
  schemaVersion: currentSchemaVersion,
  theme: "light",
  firstLaunchSetupCompleted: false,
  firstLaunchSetup: createFirstLaunchSetupState({ locale: "en", theme: "system" }),
  notificationSettings: defaultNotificationSettings(),
  profileSettings: {
    displayName: "",
    username: "",
    status: "online",
    statusText: "",
    bio: "",
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    preferredLanguage: "English",
    tags: [],
  },
  accessibilitySettings: getAppearanceStudioDefaults().accessibility,
  appearanceSettings: { themeMode: getAppearanceStudioDefaults().appearance.themeMode, language: "en", languageMode: "system", density: getAppearanceStudioDefaults().appearance.density, dateStyle: "system", timeFormat: "system" },
};

/** Reads the raw OS/browser locale string used to resolve languageMode "system". */
function readSystemLocale(): string | undefined {
  try {
    return typeof navigator !== "undefined" ? navigator.language : undefined;
  } catch {
    return undefined;
  }
}

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
  {
    fromVersion: 2,
    toVersion: 3,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 3,
      notificationSettings: {
        ...defaults.notificationSettings,
        ...(typeof settings.notificationSettings === "object" && settings.notificationSettings ? settings.notificationSettings : {}),
        quietHours: {
          ...defaults.notificationSettings.quietHours,
          ...((settings.notificationSettings as Partial<NotificationSettings> | undefined)?.quietHours ?? {}),
        },
      },
    }),
  },
  {
    fromVersion: 3,
    toVersion: 4,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 4,
      notificationSettings: {
        ...defaults.notificationSettings,
        ...(typeof settings.notificationSettings === "object" && settings.notificationSettings ? settings.notificationSettings : {}),
        allowMentionsFromMutedScopes: true,
      },
    }),
  },
  {
    fromVersion: 4,
    toVersion: 5,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 5,
      firstLaunchSetupCompleted: settings.firstLaunchSetupCompleted === true,
    }),
  },
  {
    fromVersion: 5,
    toVersion: 6,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 6,
      profileSettings: {
        ...defaults.profileSettings,
        ...(typeof settings.profileSettings === "object" && settings.profileSettings ? settings.profileSettings : {}),
      },
    }),
  },
  {
    fromVersion: 6,
    toVersion: 7,
    migrate: (settings) => ({ ...settings, schemaVersion: 7 }),
  },
  {
    fromVersion: 7,
    toVersion: 8,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 8,
      appearanceSettings: {
        ...defaults.appearanceSettings,
        ...(typeof settings.appearanceSettings === "object" && settings.appearanceSettings ? settings.appearanceSettings : {}),
        themeMode: settings.theme === "dark" ? "dark" : settings.theme === "light" ? "light" : "system",
      },
    }),
  },
  {
    fromVersion: 8,
    toVersion: 9,
    migrate: (settings) => {
      const previous = typeof settings.notificationSettings === "object" && settings.notificationSettings
        ? settings.notificationSettings as Partial<NotificationSettings> & { quietHours?: Partial<QuietHoursSettings> & { applyTo?: string } }
        : {};
      const previousApplyTo = (previous.quietHours as { applyTo?: unknown } | undefined)?.applyTo;
      const migratedApplyTo: QuietHoursApplyMode = previousApplyTo === "sounds_only_placeholder"
        ? "sounds_only"
        : previousApplyTo === "all_notifications" || previousApplyTo === "normal_messages_only" || previousApplyTo === "sounds_only"
          ? previousApplyTo
          : defaults.notificationSettings.quietHours.applyTo;
      return {
        ...settings,
        schemaVersion: 9,
        notificationSettings: {
          ...defaults.notificationSettings,
          ...previous,
          quietHours: {
            ...defaults.notificationSettings.quietHours,
            ...(previous.quietHours ?? {}),
            applyTo: migratedApplyTo,
          },
        },
      };
    },
  },
  {
    fromVersion: 9,
    toVersion: 10,
    migrate: (settings) => {
      const previous = typeof settings.notificationSettings === "object" && settings.notificationSettings
        ? settings.notificationSettings as Partial<NotificationSettings>
        : {};
      const split = splitNotificationOwnership(previous);
      return {
        ...settings,
        schemaVersion: 10,
        notificationSettings: composeNotificationSettings(split.device, split.synced),
      };
    },
  },
  {
    fromVersion: 10,
    toVersion: 11,
    migrate: (settings) => {
      const previousAppearance = typeof settings.appearanceSettings === "object" && settings.appearanceSettings
        ? settings.appearanceSettings as Partial<AppearanceSettings>
        : {};
      // A pre-existing stored language preference reflects a deliberate prior choice
      // (explicit pick, or an earlier first-launch OS-detection run) -- preserve it as
      // "manual" so upgrading does not silently change a user's language. Users who never
      // had a stored preference default to "system" going forward.
      const hadStoredLanguage = typeof previousAppearance.language === "string" && previousAppearance.language.length > 0;
      return {
        ...settings,
        schemaVersion: 11,
        appearanceSettings: {
          ...defaults.appearanceSettings,
          ...previousAppearance,
          languageMode: hadStoredLanguage ? "manual" : "system",
        },
      };
    },
  },
  {
    fromVersion: 11,
    toVersion: 12,
    migrate: (settings) => {
      const appearance = typeof settings.appearanceSettings === "object" && settings.appearanceSettings
        ? settings.appearanceSettings as Partial<AppearanceSettings>
        : {};
      const theme = appearance.themeMode === "light" || appearance.themeMode === "dark" || appearance.themeMode === "system"
        ? appearance.themeMode
        : settings.theme === "dark" ? "dark" : settings.theme === "light" ? "light" : "system";
      return {
        ...settings,
        schemaVersion: 12,
        firstLaunchSetup: createFirstLaunchSetupState({
          completed: settings.firstLaunchSetupCompleted === true,
          locale: normalizeUiLanguage(appearance.language),
          theme,
        }),
      };
    },
  },
  {
    fromVersion: 12,
    toVersion: 13,
    migrate: (settings) => {
      const appearance = typeof settings.appearanceSettings === "object" && settings.appearanceSettings
        ? settings.appearanceSettings as Partial<AppearanceSettings>
        : {};
      const theme = appearance.themeMode === "light" || appearance.themeMode === "dark" || appearance.themeMode === "system"
        ? appearance.themeMode
        : settings.theme === "dark" ? "dark" : settings.theme === "light" ? "light" : "system";
      return {
        ...settings,
        schemaVersion: 13,
        firstLaunchSetup: normalizeFirstLaunchSetupState(settings.firstLaunchSetup, {
          completed: settings.firstLaunchSetupCompleted === true,
          locale: normalizeUiLanguage(appearance.language),
          theme,
        }),
      };
    },
  },
  {
    fromVersion: 13,
    toVersion: 14,
    migrate: (settings) => ({
      ...settings,
      schemaVersion: 14,
      // `largerText` was a local boolean. Preserve its intent as semantic text size
      // while introducing validated device-only UI scale.
      accessibilitySettings: normalizeAccessibilitySettings(
        typeof settings.accessibilitySettings === "object" && settings.accessibilitySettings
          ? settings.accessibilitySettings as Parameters<typeof normalizeAccessibilitySettings>[0]
          : undefined,
      ),
    }),
  },
];

function getStoredSchemaVersion(settings: StoredPicomSettings): number {
  return typeof settings.schemaVersion === "number" && Number.isFinite(settings.schemaVersion) ? settings.schemaVersion : 0;
}

function normalizeSettings(settings: StoredPicomSettings): PicomSettings {
  const split = splitNotificationOwnership(
    (settings.notificationSettings && typeof settings.notificationSettings === "object")
      ? settings.notificationSettings as Partial<NotificationSettings>
      : {},
  );
  const appearanceSettings: AppearanceSettings = (() => {
    const languageMode: LanguageMode = settings.appearanceSettings?.languageMode === "manual" ? "manual" : "system";
    const manualLanguage = normalizeUiLanguage(settings.appearanceSettings?.language);
    const resolvedLanguage = languageMode === "system" ? resolveSystemUiLanguage(readSystemLocale()) : manualLanguage;
    return {
      ...defaults.appearanceSettings,
      ...(settings.appearanceSettings ?? {}),
      themeMode: settings.appearanceSettings?.themeMode === "light" || settings.appearanceSettings?.themeMode === "dark" || settings.appearanceSettings?.themeMode === "system" ? settings.appearanceSettings.themeMode : defaults.appearanceSettings.themeMode,
      language: resolvedLanguage,
      languageMode,
      density: settings.appearanceSettings?.density === "compact" ? "compact" : "comfortable",
      dateStyle: settings.appearanceSettings?.dateStyle === "numeric" || settings.appearanceSettings?.dateStyle === "descriptive" ? settings.appearanceSettings.dateStyle : "system",
      timeFormat: settings.appearanceSettings?.timeFormat === "12h" || settings.appearanceSettings?.timeFormat === "24h" ? settings.appearanceSettings.timeFormat : "system",
    };
  })();
  const firstLaunchSetup = normalizeFirstLaunchSetupState(
    settings.firstLaunchSetup,
    {
      completed: settings.firstLaunchSetupCompleted === true,
      locale: appearanceSettings.language,
      theme: appearanceSettings.themeMode,
    },
  );
  return {
    ...defaults,
    ...settings,
    schemaVersion: currentSchemaVersion,
    theme: settings.theme === "dark" ? "dark" : "light",
    firstLaunchSetupCompleted: firstLaunchSetup.completed,
    firstLaunchSetup,
    notificationSettings: composeNotificationSettings(split.device, split.synced),
    profileSettings: {
      ...defaults.profileSettings,
      ...(settings.profileSettings ?? {}),
      tags: Array.isArray((settings.profileSettings as Partial<ProfileSettings> | undefined)?.tags)
        ? (settings.profileSettings as Partial<ProfileSettings>).tags?.filter((tag): tag is string => typeof tag === "string").slice(0, 12) ?? []
        : [],
    },
    accessibilitySettings: normalizeAccessibilitySettings(
      typeof settings.accessibilitySettings === "object" && settings.accessibilitySettings
        ? settings.accessibilitySettings as Parameters<typeof normalizeAccessibilitySettings>[0]
        : undefined,
    ),
    appearanceSettings,
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
    // A newer local payload can be produced by a later desktop build. Preserve the
    // recognized device fields (especially completed first-run state) rather than
    // dropping a user back into setup when an older renderer opens it.
    return normalizeSettings(working);
  }

  return normalizeSettings(working);
}

function localStore(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function sessionStore(): Storage | null {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
}

function cloneSettings(settings: PicomSettings): PicomSettings {
  return {
    ...settings,
    notificationSettings: { ...settings.notificationSettings, quietHours: { ...settings.notificationSettings.quietHours } },
    profileSettings: { ...settings.profileSettings, tags: [...settings.profileSettings.tags] },
    accessibilitySettings: { ...settings.accessibilitySettings },
    appearanceSettings: { ...settings.appearanceSettings },
    firstLaunchSetup: { ...settings.firstLaunchSetup },
  };
}

function importLegacySettings(storage: Storage): PicomSettings | null {
  const legacyTheme = storage.getItem("picom:theme") ?? storage.getItem("picom-theme");
  const legacyFirstLaunch = storage.getItem("picom:first-launch-completed") ?? storage.getItem("picom-first-launch-completed");
  if (!legacyTheme && !legacyFirstLaunch) return null;
  const next = normalizeSettings({ schemaVersion: currentSchemaVersion, theme: legacyTheme === "dark" ? "dark" : "light", firstLaunchSetupCompleted: legacyFirstLaunch === "true" });
  for (const legacyKey of ["picom:theme", "picom-theme", "picom:first-launch-completed", "picom-first-launch-completed"]) storage.removeItem(legacyKey);
  return next;
}

function backupInvalidSettings(raw: string, storage: Storage): void {
  try {
    storage.setItem(`${backupKeyPrefix}.${Date.now()}`, JSON.stringify({ reason: "invalid_json", byteLength: raw.length, recoveredAt: new Date().toISOString() }));
    storage.setItem("picom:safe-mode:forced", "true");
    storage.setItem("picom:safe-mode:reason", "corrupted_local_settings");
    storage.removeItem(key);
  } catch {
    // Safe defaults remain available even when storage recovery is unavailable.
  }
}

function writeSettings(next: PicomSettings): boolean {
  const normalized = cloneSettings(next);
  cachedSettings = normalized;
  let persisted = false;
  try { const storage = localStore(); if (storage) { storage.setItem(key, JSON.stringify(normalized)); persisted = true; } } catch { /* Keep in-memory settings for this session. */ }
  for (const listener of listeners) listener(cloneSettings(normalized));
  return persisted;
}

export const settingsService = {
  getDefaultSettings(): PicomSettings {
    return cloneSettings(defaults);
  },
  getSettings(): PicomSettings {
    if (cachedSettings) return cloneSettings(cachedSettings);
    const storage = localStore();
    if (!storage) return cloneSettings(defaults);
    const raw = storage.getItem(key);
    if (!raw) {
      const legacy = importLegacySettings(storage);
      if (legacy) { writeSettings(legacy); return cloneSettings(legacy); }
      cachedSettings = cloneSettings(defaults);
      return cloneSettings(defaults);
    }

    try {
      const parsed = JSON.parse(raw) as StoredPicomSettings;
      const next = migrateSettings(parsed);
      if (JSON.stringify(next) !== raw) {
        writeSettings(next);
      }
      cachedSettings = cloneSettings(next);
      return cloneSettings(next);
    } catch {
      backupInvalidSettings(raw, storage);
      cachedSettings = cloneSettings(defaults);
      return cloneSettings(defaults);
    }
  },
  updateSettings(partial: Partial<PicomSettings>) {
    const next = normalizeSettings({ ...this.getSettings(), ...partial, schemaVersion: currentSchemaVersion });
    writeSettings(next);
    queueMicrotask(() => { void settingsService.syncAccountSettings(next); });
    return next;
  },
  updateNotificationSettings(partial: Partial<NotificationSettings>) {
    const current = this.getSettings();
    // securityAlerts cannot be disabled by product policy.
    const safePartial = { ...partial, securityAlerts: true as const };
    const merged = normalizeSettings({
      ...current,
      notificationSettings: {
        ...current.notificationSettings,
        ...safePartial,
        quietHours: safePartial.quietHours
          ? { ...current.notificationSettings.quietHours, ...safePartial.quietHours }
          : current.notificationSettings.quietHours,
      },
      schemaVersion: currentSchemaVersion,
    });
    const previous = current;
    writeSettings(merged);
    // Persist device delivery keys to main-process store when available (best-effort).
    const device = splitNotificationOwnership(merged.notificationSettings).device;
    try {
      const bridge = typeof window !== "undefined" ? window.picomDesktop?.settings : undefined;
      void bridge?.set?.({
        nativeDesktopEnabled: device.nativeDesktopEnabled,
        soundEnabled: device.soundEnabled,
        notifyWhileFocused: device.notifyWhileFocused,
        taskbarFlash: device.taskbarFlash,
        trayBadge: device.trayBadge,
        titlebarBadge: device.titlebarBadge,
        quietHours: device.quietHours,
      });
    } catch {
      /* renderer without bridge keeps localStorage SoT for device keys */
    }
    queueMicrotask(async () => {
      const synced = await settingsService.syncAccountSettings(merged);
      if (!synced.ok && (synced.error === "SETTINGS_SYNC_FAILED" || synced.error === "SETTINGS_BACKEND_UNAVAILABLE")) {
        // Optimistic rollback for synced failure — restore previous composed settings.
        writeSettings(previous);
      }
    });
    return merged;
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
  updateAppearanceSettings(partial: Partial<AppearanceSettings>) {
    const current = this.getSettings();
    // Picking a language explicitly pins languageMode to "manual" unless the caller also
    // sets languageMode itself (e.g. the "use system language" toggle passes languageMode:
    // "system" without a language, letting normalizeSettings re-resolve it from the OS).
    const impliedMode: Partial<AppearanceSettings> =
      partial.language !== undefined && partial.languageMode === undefined ? { languageMode: "manual" } : {};
    const nextAppearance = {
      ...current.appearanceSettings,
      ...impliedMode,
      ...partial,
    };
    const normalizedAppearance = normalizeSettings({ ...current, appearanceSettings: nextAppearance }).appearanceSettings;
    const syncFirstLaunchSetup = partial.themeMode !== undefined || partial.language !== undefined;
    const firstLaunchSetup = syncFirstLaunchSetup
      ? applyFirstLaunchSetupPatch(current.firstLaunchSetup, {
        locale: normalizedAppearance.language,
        theme: normalizedAppearance.themeMode,
      })
      : current.firstLaunchSetup;
    return this.updateSettings({
      appearanceSettings: nextAppearance,
      firstLaunchSetup,
    });
  },
  getAppearanceStudioDefaults() {
    return getAppearanceStudioDefaults();
  },
  resetAppearanceStudio() {
    const current = this.getSettings();
    const recommended = getAppearanceStudioDefaults();
    const firstLaunchSetup = applyFirstLaunchSetupPatch(current.firstLaunchSetup, {
      theme: recommended.appearance.themeMode,
    });
    return this.updateSettings({
      appearanceSettings: {
        ...current.appearanceSettings,
        ...recommended.appearance,
      },
      accessibilitySettings: recommended.accessibility,
      firstLaunchSetup,
    });
  },
  getFirstLaunchSetupState(): FirstLaunchSetupState {
    return { ...this.getSettings().firstLaunchSetup };
  },
  updateFirstLaunchSetupState(patch: FirstLaunchSetupStatePatch) {
    const current = this.getSettings();
    const firstLaunchSetup = applyFirstLaunchSetupPatch(current.firstLaunchSetup, patch);
    const next = normalizeSettings({
      ...current,
      theme: firstLaunchSetup.theme === "system" ? current.theme : firstLaunchSetup.theme,
      firstLaunchSetupCompleted: firstLaunchSetup.completed,
      firstLaunchSetup,
      appearanceSettings: {
        ...current.appearanceSettings,
        themeMode: firstLaunchSetup.theme,
        language: firstLaunchSetup.locale,
        languageMode: "manual",
      },
    });
    // First-launch state is device-only and must remain usable before authentication;
    // avoid account sync/rollback paths for this local atomic update.
    writeSettings(next);
    return next;
  },
  skipFirstLaunchSetupStep(stepId: FirstLaunchOptionalStepId) {
    const current = this.getSettings();
    const firstLaunchSetup = applyFirstLaunchSetupSkip(current.firstLaunchSetup, stepId);
    const next = normalizeSettings({
      ...current,
      firstLaunchSetupCompleted: firstLaunchSetup.completed,
      firstLaunchSetup,
    });
    writeSettings(next);
    return next;
  },
  completeFirstLaunchSetup(): Readonly<{ ok: boolean; settings: PicomSettings }> {
    const current = this.getSettings();
    if (current.firstLaunchSetup.completed && current.firstLaunchSetupCompleted) {
      return { ok: true, settings: current };
    }
    const firstLaunchSetup = completeFirstLaunchSetupState(current.firstLaunchSetup);
    const next = normalizeSettings({
      ...current,
      theme: firstLaunchSetup.theme === "system" ? current.theme : firstLaunchSetup.theme,
      firstLaunchSetupCompleted: true,
      firstLaunchSetup,
      appearanceSettings: {
        ...current.appearanceSettings,
        themeMode: firstLaunchSetup.theme,
        language: firstLaunchSetup.locale,
        languageMode: "manual",
      },
    });
    const committed = commitFirstLaunchCompletion({
      current,
      next,
      alreadyComplete: false,
      persist: (value) => {
        try {
          const storage = localStore();
          if (!storage) return false;
          storage.setItem(key, JSON.stringify(value));
          cachedSettings = cloneSettings(value);
          for (const listener of listeners) listener(cloneSettings(value));
          return true;
        } catch {
          return false;
        }
      },
    });
    return { ok: committed.ok, settings: committed.value };
  },
  resetFirstLaunchSetup() {
    const current = this.getSettings();
    const firstLaunchSetup = createFirstLaunchSetupState({
      locale: current.appearanceSettings.language,
      theme: current.appearanceSettings.themeMode,
    });
    const next = normalizeSettings({ ...current, firstLaunchSetupCompleted: false, firstLaunchSetup });
    writeSettings(next);
    return next;
  },
  subscribe(listener: (settings: PicomSettings) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  requestInitialSection(section: SettingsSection) { try { sessionStore()?.setItem(initialSectionKey, section); return true; } catch { return false; } },
  requestInitialFocus(target: SettingsFocusTarget) { try { sessionStore()?.setItem(initialFocusKey, target); return true; } catch { return false; } },
  consumeInitialSection(): SettingsSection {
    try {
      const storage = sessionStore();
      const requested = storage?.getItem(initialSectionKey);
      storage?.removeItem(initialSectionKey);
      return settingsSections.includes(requested as SettingsSection) ? requested as SettingsSection : "Appearance";
    } catch { return "Appearance"; }
  },
  consumeInitialFocus(): SettingsFocusTarget | null {
    try {
      const storage = sessionStore();
      const requested = storage?.getItem(initialFocusKey);
      storage?.removeItem(initialFocusKey);
      return requested === "voice-microphone" || requested === "voice-output" ? requested : null;
    } catch { return null; }
  },
  async syncAccountSettings(settings?: PicomSettings): Promise<{ ok: true } | { ok: false; error: string }> {
    const accountSettings = settings ?? settingsService.getSettings();
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "SETTINGS_BACKEND_UNAVAILABLE" };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, error: "SETTINGS_AUTH_REQUIRED" };
    // Sync only account-owned notification keys — never device delivery UX.
    const notificationSettings = JSON.parse(JSON.stringify(toSyncedNotificationPayload(accountSettings.notificationSettings))) as Json;
    const result = await client.from("user_settings").upsert({
      user_id: data.user.id,
      schema_version: currentSchemaVersion,
      theme_mode: accountSettings.appearanceSettings.themeMode,
      preferred_locale: accountSettings.appearanceSettings.language,
      preferred_locale_mode: accountSettings.appearanceSettings.languageMode,
      notification_settings: notificationSettings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return result.error ? { ok: false, error: "SETTINGS_SYNC_FAILED" } : { ok: true };
  },
  async hydrateAccountSettings(): Promise<{ ok: true; settings: PicomSettings } | { ok: false; error: string; settings: PicomSettings }> {
    const current = this.getSettings();
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "SETTINGS_BACKEND_UNAVAILABLE", settings: current };
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, error: "SETTINGS_AUTH_REQUIRED", settings: current };
    const result = await client.from("user_settings").select("schema_version,theme_mode,preferred_locale,preferred_locale_mode,notification_settings").eq("user_id", auth.user.id).maybeSingle();
    if (result.error) return { ok: false, error: "SETTINGS_LOAD_FAILED", settings: current };
    if (!result.data) { const synced = await this.syncAccountSettings(current); return synced.ok ? { ok: true, settings: current } : { ok: false, error: synced.error, settings: current }; }
    const themeMode = result.data.theme_mode as ThemePreference;
    // Never trust the remote value blindly -- normalizeUiLanguage/languageMode guard below
    // fall back safely on corrupt/invalid data (e.g. a locale removed from SUPPORTED_UI_LANGUAGES).
    const remoteLanguageMode: LanguageMode = result.data.preferred_locale_mode === "manual" ? "manual" : "system";
    const remoteLanguage = normalizeUiLanguage(result.data.preferred_locale);
    const mergedNotifications = mergeRemoteNotificationSettings(
      current.notificationSettings,
      result.data.notification_settings as unknown as Partial<NotificationSettings>,
    );
    // Device first-run preferences are intentionally stable across account switches.
    // Account settings still hydrate notification policy, but do not replace this
    // desktop's explicit language or theme selection.
    const deviceAppearance = current.firstLaunchSetup.completed
      ? {
        ...current.appearanceSettings,
        themeMode: current.firstLaunchSetup.theme,
        language: current.firstLaunchSetup.locale,
        languageMode: "manual" as const,
      }
      : {
        ...current.appearanceSettings,
        themeMode,
        language: remoteLanguage,
        languageMode: remoteLanguageMode,
      };
    const remote = normalizeSettings({
      ...current,
      theme: deviceAppearance.themeMode === "system" ? current.theme : deviceAppearance.themeMode,
      appearanceSettings: deviceAppearance,
      notificationSettings: mergedNotifications,
    });
    writeSettings(remote);
    return { ok: true, settings: remote };
  },
  resetSettings() { try { localStore()?.removeItem(key); } catch { /* In-memory reset still succeeds. */ } cachedSettings = cloneSettings(defaults); for (const listener of listeners) listener(cloneSettings(defaults)); return cloneSettings(defaults); },
};
