import type { ProfileStatus } from "../types/profile";
import type { Json } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { normalizeUiLanguage, type UiLanguage } from "./localization/uiLanguages";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
export type { UiLanguage };
export type DesktopDensity = "comfortable" | "compact";
export type DateStylePreference = "system" | "numeric" | "descriptive";
export type TimeFormatPreference = "system" | "12h" | "24h";
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
    sections: ["Appearance", "Notifications", "Privacy & Safety"],
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
export interface AccessibilitySettings { highContrast: boolean; reducedMotion: boolean; largerText: boolean; focusRingStrong: boolean; }
export interface AppearanceSettings { themeMode: ThemePreference; language: UiLanguage; density: DesktopDensity; dateStyle: DateStylePreference; timeFormat: TimeFormatPreference; }
export interface PicomSettings { schemaVersion: number; theme: ThemeMode; firstLaunchSetupCompleted: boolean; notificationSettings: NotificationSettings; profileSettings: ProfileSettings; accessibilitySettings: AccessibilitySettings; appearanceSettings: AppearanceSettings; }
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
const currentSchemaVersion = 10;
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
  accessibilitySettings: { highContrast: false, reducedMotion: false, largerText: false, focusRingStrong: false },
  appearanceSettings: { themeMode: "system", language: "en", density: "comfortable", dateStyle: "system", timeFormat: "system" },
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
  return {
    ...defaults,
    ...settings,
    schemaVersion: currentSchemaVersion,
    theme: settings.theme === "dark" ? "dark" : "light",
    firstLaunchSetupCompleted: settings.firstLaunchSetupCompleted === true,
    notificationSettings: composeNotificationSettings(split.device, split.synced),
    profileSettings: {
      ...defaults.profileSettings,
      ...(settings.profileSettings ?? {}),
      tags: Array.isArray((settings.profileSettings as Partial<ProfileSettings> | undefined)?.tags)
        ? (settings.profileSettings as Partial<ProfileSettings>).tags?.filter((tag): tag is string => typeof tag === "string").slice(0, 12) ?? []
        : [],
    },
    accessibilitySettings: {
      ...defaults.accessibilitySettings,
      ...(settings.accessibilitySettings ?? {}),
    },
    appearanceSettings: {
      ...defaults.appearanceSettings,
      ...(settings.appearanceSettings ?? {}),
      themeMode: settings.appearanceSettings?.themeMode === "light" || settings.appearanceSettings?.themeMode === "dark" || settings.appearanceSettings?.themeMode === "system" ? settings.appearanceSettings.themeMode : defaults.appearanceSettings.themeMode,
      language: normalizeUiLanguage(settings.appearanceSettings?.language),
      density: settings.appearanceSettings?.density === "compact" ? "compact" : "comfortable",
      dateStyle: settings.appearanceSettings?.dateStyle === "numeric" || settings.appearanceSettings?.dateStyle === "descriptive" ? settings.appearanceSettings.dateStyle : "system",
      timeFormat: settings.appearanceSettings?.timeFormat === "12h" || settings.appearanceSettings?.timeFormat === "24h" ? settings.appearanceSettings.timeFormat : "system",
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
    return this.updateSettings({
      appearanceSettings: {
        ...current.appearanceSettings,
        ...partial,
      },
    });
  },
  completeFirstLaunchSetup(theme: ThemeMode) {
    return this.updateSettings({ theme, firstLaunchSetupCompleted: true });
  },
  resetFirstLaunchSetup() {
    return this.updateSettings({ firstLaunchSetupCompleted: false });
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
    const result = await client.from("user_settings").upsert({ user_id: data.user.id, schema_version: currentSchemaVersion, theme_mode: accountSettings.appearanceSettings.themeMode, notification_settings: notificationSettings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return result.error ? { ok: false, error: "SETTINGS_SYNC_FAILED" } : { ok: true };
  },
  async hydrateAccountSettings(): Promise<{ ok: true; settings: PicomSettings } | { ok: false; error: string; settings: PicomSettings }> {
    const current = this.getSettings();
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "SETTINGS_BACKEND_UNAVAILABLE", settings: current };
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, error: "SETTINGS_AUTH_REQUIRED", settings: current };
    const result = await client.from("user_settings").select("schema_version,theme_mode,notification_settings").eq("user_id", auth.user.id).maybeSingle();
    if (result.error) return { ok: false, error: "SETTINGS_LOAD_FAILED", settings: current };
    if (!result.data) { const synced = await this.syncAccountSettings(current); return synced.ok ? { ok: true, settings: current } : { ok: false, error: synced.error, settings: current }; }
    const themeMode = result.data.theme_mode as ThemePreference;
    const mergedNotifications = mergeRemoteNotificationSettings(
      current.notificationSettings,
      result.data.notification_settings as unknown as Partial<NotificationSettings>,
    );
    const remote = normalizeSettings({
      ...current,
      theme: themeMode === "system" ? current.theme : themeMode,
      appearanceSettings: { ...current.appearanceSettings, themeMode },
      notificationSettings: mergedNotifications,
    });
    writeSettings(remote);
    return { ok: true, settings: remote };
  },
  resetSettings() { try { localStore()?.removeItem(key); } catch { /* In-memory reset still succeeds. */ } cachedSettings = cloneSettings(defaults); for (const listener of listeners) listener(cloneSettings(defaults)); return cloneSettings(defaults); },
};
