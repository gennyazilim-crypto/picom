import type { NotificationDigestMode } from "../notificationDigestService";
import type { NotificationSettings, QuietHoursSettings } from "../settingsService";

/** Device-local delivery UX — main-process / local device store only (never account sync SoT). */
export const NOTIFICATION_DEVICE_KEYS = [
  "nativeDesktopEnabled",
  "soundEnabled",
  "quietHours",
  "notifyWhileFocused",
  "taskbarFlash",
  "trayBadge",
  "titlebarBadge",
] as const;

/** Account-synced preference keys — Supabase `user_settings.notification_settings`. */
export const NOTIFICATION_SYNCED_KEYS = [
  "enabled",
  "muted",
  "mentionsOnly",
  "mentions",
  "replies",
  "reactions",
  "directMessages",
  "communityAnnouncements",
  "friendRequests",
  "friendAcceptances",
  "friendOnline",
  "followedUsersLive",
  "followedPublishersLive",
  "showMessagePreview",
  "radioLive",
  "radioReminders",
  "podcastReleases",
  "eventReminders",
  "incomingCalls",
  "missedCalls",
  "securityAlerts",
  "productAnnouncements",
  "allowMentionsFromMutedScopes",
  "digestMode",
] as const;

export type NotificationDeviceKey = (typeof NOTIFICATION_DEVICE_KEYS)[number];
export type NotificationSyncedKey = (typeof NOTIFICATION_SYNCED_KEYS)[number];

export type NotificationDeviceSettings = Readonly<{
  nativeDesktopEnabled: boolean;
  soundEnabled: boolean;
  quietHours: QuietHoursSettings;
  notifyWhileFocused: boolean;
  taskbarFlash: boolean;
  trayBadge: boolean;
  titlebarBadge: boolean;
}>;

export type NotificationSyncedSettings = Readonly<{
  enabled: boolean;
  muted: boolean;
  mentionsOnly: boolean;
  mentions: boolean;
  replies: boolean;
  reactions: boolean;
  directMessages: boolean;
  communityAnnouncements: boolean;
  friendRequests: boolean;
  friendAcceptances: boolean;
  friendOnline: boolean;
  followedUsersLive: boolean;
  followedPublishersLive: boolean;
  showMessagePreview: boolean;
  radioLive: boolean;
  radioReminders: boolean;
  podcastReleases: boolean;
  eventReminders: boolean;
  incomingCalls: boolean;
  missedCalls: boolean;
  /** Always enforced true for policy; UI must show as non-disableable. */
  securityAlerts: true;
  productAnnouncements: boolean;
  allowMentionsFromMutedScopes: boolean;
  digestMode: NotificationDigestMode;
}>;

const LEGACY_APPLY_TO: Record<string, QuietHoursSettings["applyTo"]> = {
  sounds_only_placeholder: "sounds_only",
  all_notifications: "all_notifications",
  normal_messages_only: "normal_messages_only",
  sounds_only: "sounds_only",
};

export const defaultNotificationDeviceSettings = (): NotificationDeviceSettings => ({
  nativeDesktopEnabled: true,
  soundEnabled: true,
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "07:00",
    applyTo: "normal_messages_only",
    allowMentions: true,
  },
  notifyWhileFocused: true,
  taskbarFlash: true,
  trayBadge: true,
  titlebarBadge: true,
});

export const defaultNotificationSyncedSettings = (): NotificationSyncedSettings => ({
  enabled: true,
  muted: false,
  mentionsOnly: false,
  mentions: true,
  replies: true,
  reactions: true,
  directMessages: true,
  communityAnnouncements: true,
  friendRequests: true,
  friendAcceptances: true,
  friendOnline: false,
  followedUsersLive: true,
  followedPublishersLive: true,
  showMessagePreview: false,
  radioLive: true,
  radioReminders: true,
  podcastReleases: true,
  eventReminders: true,
  incomingCalls: true,
  missedCalls: true,
  securityAlerts: true,
  productAnnouncements: true,
  allowMentionsFromMutedScopes: true,
  digestMode: "off",
});

export function ownershipOfNotificationKey(key: string): "device" | "synced" | "unknown" {
  if ((NOTIFICATION_DEVICE_KEYS as readonly string[]).includes(key)) return "device";
  if ((NOTIFICATION_SYNCED_KEYS as readonly string[]).includes(key)) return "synced";
  return "unknown";
}

export function rejectUnknownNotificationKeys(partial: Record<string, unknown>): {
  ok: true;
  cleaned: Record<string, unknown>;
} | {
  ok: false;
  error: "UNKNOWN_NOTIFICATION_KEY";
  unknownKeys: string[];
} {
  const unknownKeys = Object.keys(partial).filter((key) => ownershipOfNotificationKey(key) === "unknown");
  if (unknownKeys.length > 0) {
    return { ok: false, error: "UNKNOWN_NOTIFICATION_KEY", unknownKeys };
  }
  return { ok: true, cleaned: { ...partial } };
}

export function migrateLegacyQuietHoursApplyTo(value: unknown): QuietHoursSettings["applyTo"] {
  if (typeof value !== "string") return "normal_messages_only";
  return LEGACY_APPLY_TO[value] ?? "normal_messages_only";
}

/** Idempotent split of a legacy NotificationSettings blob into device + synced slices. */
export function splitNotificationOwnership(raw: Partial<NotificationSettings> | Record<string, unknown> | null | undefined): {
  device: NotificationDeviceSettings;
  synced: NotificationSyncedSettings;
} {
  const deviceDefaults = defaultNotificationDeviceSettings();
  const syncedDefaults = defaultNotificationSyncedSettings();
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<NotificationSettings> & Record<string, unknown>;
  const quiet = (source.quietHours && typeof source.quietHours === "object")
    ? source.quietHours as Partial<QuietHoursSettings>
    : {};

  return {
    device: {
      nativeDesktopEnabled: source.nativeDesktopEnabled !== false,
      soundEnabled: source.soundEnabled !== false,
      quietHours: {
        enabled: quiet.enabled === true,
        startTime: typeof quiet.startTime === "string" ? quiet.startTime : deviceDefaults.quietHours.startTime,
        endTime: typeof quiet.endTime === "string" ? quiet.endTime : deviceDefaults.quietHours.endTime,
        applyTo: migrateLegacyQuietHoursApplyTo(quiet.applyTo),
        allowMentions: quiet.allowMentions !== false,
      },
      notifyWhileFocused: source.notifyWhileFocused !== false,
      taskbarFlash: source.taskbarFlash !== false,
      trayBadge: source.trayBadge !== false,
      titlebarBadge: source.titlebarBadge !== false,
    },
    synced: {
      enabled: source.enabled !== false,
      muted: source.muted === true,
      mentionsOnly: source.mentionsOnly === true,
      mentions: source.mentions !== false,
      replies: source.replies !== false,
      reactions: source.reactions !== false,
      directMessages: source.directMessages !== false,
      communityAnnouncements: source.communityAnnouncements !== false,
      friendRequests: source.friendRequests !== false,
      friendAcceptances: source.friendAcceptances !== false,
      friendOnline: source.friendOnline === true,
      followedUsersLive: source.followedUsersLive !== false,
      followedPublishersLive: source.followedPublishersLive !== false,
      showMessagePreview: source.showMessagePreview === true,
      radioLive: source.radioLive !== false,
      radioReminders: source.radioReminders !== false,
      podcastReleases: source.podcastReleases !== false,
      eventReminders: source.eventReminders !== false,
      incomingCalls: source.incomingCalls !== false,
      missedCalls: source.missedCalls !== false,
      securityAlerts: true,
      productAnnouncements: source.productAnnouncements !== false,
      allowMentionsFromMutedScopes: source.allowMentionsFromMutedScopes !== false,
      digestMode: source.digestMode === "hourly_placeholder" || source.digestMode === "daily_placeholder" || source.digestMode === "off"
        ? source.digestMode
        : "off",
    },
  };
}

/** Compose runtime NotificationSettings used by notificationService (device + synced). */
export function composeNotificationSettings(
  device: NotificationDeviceSettings,
  synced: NotificationSyncedSettings,
): NotificationSettings {
  return {
    enabled: synced.enabled,
    nativeDesktopEnabled: device.nativeDesktopEnabled,
    soundEnabled: device.soundEnabled,
    muted: synced.muted,
    mentionsOnly: synced.mentionsOnly,
    mentions: synced.mentions,
    replies: synced.replies,
    reactions: synced.reactions,
    directMessages: synced.directMessages,
    communityAnnouncements: synced.communityAnnouncements,
    friendRequests: synced.friendRequests,
    friendAcceptances: synced.friendAcceptances,
    friendOnline: synced.friendOnline,
    followedUsersLive: synced.followedUsersLive,
    followedPublishersLive: synced.followedPublishersLive,
    showMessagePreview: synced.showMessagePreview,
    radioLive: synced.radioLive,
    radioReminders: synced.radioReminders,
    podcastReleases: synced.podcastReleases,
    eventReminders: synced.eventReminders,
    allowMentionsFromMutedScopes: synced.allowMentionsFromMutedScopes,
    digestMode: synced.digestMode,
    quietHours: { ...device.quietHours },
    incomingCalls: synced.incomingCalls,
    missedCalls: synced.missedCalls,
    securityAlerts: true,
    productAnnouncements: synced.productAnnouncements,
    notifyWhileFocused: device.notifyWhileFocused,
    taskbarFlash: device.taskbarFlash,
    trayBadge: device.trayBadge,
    titlebarBadge: device.titlebarBadge,
  };
}

/** Payload written to Supabase — device keys stripped. */
export function toSyncedNotificationPayload(settings: NotificationSettings): NotificationSyncedSettings {
  const { synced } = splitNotificationOwnership(settings);
  return synced;
}

/**
 * Merge remote synced prefs into current settings without overwriting device-local delivery keys.
 */
export function mergeRemoteNotificationSettings(
  current: NotificationSettings,
  remote: Partial<NotificationSettings> | null | undefined,
): NotificationSettings {
  const currentSplit = splitNotificationOwnership(current);
  const remoteSplit = splitNotificationOwnership(remote ?? {});
  return composeNotificationSettings(currentSplit.device, {
    ...currentSplit.synced,
    ...remoteSplit.synced,
    securityAlerts: true,
  });
}

export function isSecurityAlertLocked(settings: NotificationSettings): boolean {
  return settings.securityAlerts === true;
}

export function resolveNotificationToggleEnabled(
  settings: NotificationSettings,
  osPermission: NotificationPermission | "unsupported",
  key: "nativeDesktopEnabled" | "soundEnabled",
): boolean {
  if (osPermission === "denied") return false;
  if (!settings.enabled) return false;
  if (key === "soundEnabled" && !settings.nativeDesktopEnabled) return false;
  return settings[key];
}
