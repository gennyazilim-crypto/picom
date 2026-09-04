import { platformService } from "./platformService";
import { settingsService, type NotificationSettings, type QuietHoursSettings } from "./settingsService";
import { notificationDigestService } from "./notificationDigestService";
import { emergencyKillSwitchService } from "./emergencyKillSwitchService";
import { notificationPolicyStateService } from "./notificationPolicyStateService";
import { deepLinkService } from "./deepLinkService";
import type { NotificationCategory } from "../types/notifications";

export type { NotificationCategory } from "../types/notifications";

/** Electron native notifications are system-controlled, not browser-granted. */
export type NotificationPermissionState = NotificationPermission | "system-controlled" | "unsupported";
export type NotificationCapability =
  | "native-checking"
  | "native-available"
  | "native-unsupported"
  | "browser-permission-required"
  | "browser-granted"
  | "browser-blocked"
  | "unsupported";

export type NotificationRuntimeStatus = Readonly<{
  runtime: string;
  platform: string;
  permission: NotificationPermissionState;
  capability: NotificationCapability;
  supported: boolean;
  nativeBridgeAvailable: boolean;
  requiresPermission: boolean;
  nativeDesktopEnabled: boolean;
  soundEnabled: boolean;
  settings: NotificationSettings;
}>;

export interface NativeNotificationPayload {
  title: string;
  body?: string;
  category?: NotificationCategory;
  tag?: string;
  silent?: boolean;
  deepLink?: string;
  routing?: Omit<NotificationRouteContext, "category">;
}

export interface NotificationServiceResult {
  ok: boolean;
  reason?: string;
  permission?: NotificationPermissionState;
}

export type NotificationTestCopy = Readonly<{ title: string; body: string }>;

export interface NotificationRouteContext {
  category: NotificationCategory;
  isMention?: boolean;
  appFocused?: boolean;
  activeChannelId?: string | null;
  eventChannelId?: string | null;
  communityId?: string | null;
  channelId?: string | null;
  isNearBottom?: boolean;
  channelMuted?: boolean;
  communityMuted?: boolean;
  activeMeetingRoomId?: string | null;
  eventMeetingRoomId?: string | null;
  doNotDisturb?: boolean;
  settings?: NotificationSettings;
}

export interface NotificationRouteDecision {
  desktop: boolean;
  inbox: boolean;
  inAppUnread: boolean;
  reason: string;
}

const recentNativeNotifications = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5_000;
let nativeCapability: boolean | null = null;

function isMessageLikeCategory(category: NotificationCategory): boolean {
  return category === "message" || category === "direct_message" || category === "reply" || category === "reaction" || category === "community_announcement";
}

export function isNotificationCategoryEnabled(settings: NotificationSettings, category: NotificationCategory): boolean {
  if (category === "mention") return settings.mentions;
  if (category === "reply") return settings.replies;
  if (category === "reaction") return settings.reactions;
  if (category === "direct_message") return settings.directMessages;
  if (category === "community_announcement") return settings.communityAnnouncements;
  if (category === "friend_request") return settings.friendRequests;
  if (category === "friend_acceptance") return settings.friendAcceptances;
  if (category === "friend_online") return settings.friendOnline;
  if (category === "followed_user_live") return settings.followedUsersLive;
  if (category === "followed_publisher_live") return settings.followedPublishersLive;
  if (category === "radio_live") return settings.radioLive;
  if (category === "radio_reminder") return settings.radioReminders;
  if (category === "podcast_release") return settings.podcastReleases;
  if (category === "event_reminder") return settings.eventReminders;
  if (category === "incoming_call") return settings.incomingCalls;
  return true;
}

function nativeNotificationKey(payload: NativeNotificationPayload): string {
  return payload.tag?.trim() || `${payload.category ?? "system"}:${payload.title}:${payload.body ?? ""}`;
}

function claimNativeNotification(payload: NativeNotificationPayload, now = Date.now()): boolean {
  for (const [key, timestamp] of recentNativeNotifications) if (now - timestamp > DUPLICATE_WINDOW_MS) recentNativeNotifications.delete(key);
  const key = nativeNotificationKey(payload);
  const previous = recentNativeNotifications.get(key);
  if (previous !== undefined && now - previous <= DUPLICATE_WINDOW_MS) return false;
  recentNativeNotifications.set(key, now);
  return true;
}

function releaseNativeNotification(payload: NativeNotificationPayload): void {
  recentNativeNotifications.delete(nativeNotificationKey(payload));
}

function parseMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isQuietHoursActive(quietHours: QuietHoursSettings, now = new Date()): boolean {
  if (!quietHours.enabled) return false;

  const start = parseMinutes(quietHours.startTime);
  const end = parseMinutes(quietHours.endTime);

  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function quietHoursSuppressesDesktop(settings: NotificationSettings, isMention: boolean, category: NotificationCategory, now = new Date()): boolean {
  if (!isQuietHoursActive(settings.quietHours, now)) return false;
  if (isMention && settings.quietHours.allowMentions) return false;
  if (settings.quietHours.applyTo === "all_notifications") return true;
  if (settings.quietHours.applyTo === "normal_messages_only") return isMessageLikeCategory(category) && !isMention;
  return false;
}

export function quietHoursShouldSilence(settings: NotificationSettings, isMention: boolean, now = new Date()): boolean {
  return isQuietHoursActive(settings.quietHours, now)
    && settings.quietHours.applyTo === "sounds_only"
    && !(isMention && settings.quietHours.allowMentions);
}

function getNotificationConstructor(): typeof Notification | null {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification : null;
}

function getNativeNotificationBridge() {
  return typeof window === "undefined" ? null : window.picomDesktop?.showNotification ?? null;
}

function getNativeNotificationTestBridge() {
  return typeof window === "undefined" ? null : window.picomDesktop?.notifications ?? null;
}

export function decideNotificationRoute(context: NotificationRouteContext): NotificationRouteDecision {
  const settings = context.settings ?? settingsService.getSettings().notificationSettings;
  const policyState = notificationPolicyStateService.getSnapshot();
  const isActiveChannel = Boolean(context.activeChannelId && context.eventChannelId && context.activeChannelId === context.eventChannelId);
  const isActiveMeeting = Boolean(context.activeMeetingRoomId && context.eventMeetingRoomId && context.activeMeetingRoomId === context.eventMeetingRoomId);
  const isMention = Boolean(context.isMention || context.category === "mention");
  const doNotDisturb = Boolean(settings.muted || context.doNotDisturb || policyState.doNotDisturb);
  const channelMuted = Boolean(context.channelMuted || notificationPolicyStateService.isChannelMuted(context.channelId ?? context.eventChannelId));
  const communityMuted = Boolean(context.communityMuted || notificationPolicyStateService.isCommunityMuted(context.communityId));

  if (!settings.enabled) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "Desktop notifications are disabled in settings." };
  }

  if (!isNotificationCategoryEnabled(settings, context.category)) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "This notification category is disabled in settings." };
  }

  if (doNotDisturb) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Notifications are currently muted." };
  }

  if (quietHoursSuppressesDesktop(settings, isMention, context.category)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Quiet Hours suppressed this desktop notification." };
  }

  if (settings.mentionsOnly && isMessageLikeCategory(context.category) && !isMention) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Only mention notifications are enabled." };
  }

  if (notificationDigestService.shouldDigestNotification(settings, context.category, isMention)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Notification digest placeholder grouped this normal message." };
  }

  if ((channelMuted || communityMuted) && (!isMention || !settings.allowMentionsFromMutedScopes)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Muted channel or community suppressed this notification." };
  }

  if (context.appFocused && isActiveMeeting) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "User is already viewing this meeting." };
  }

  if (context.appFocused && isActiveChannel && context.isNearBottom) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "User is already reading the active channel." };
  }

  if (context.appFocused && isActiveChannel) {
    return { desktop: false, inbox: true, inAppUnread: true, reason: "Active channel notification routed in-app." };
  }

  if (!settings.nativeDesktopEnabled) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Native desktop notifications are disabled in settings." };
  }

  return { desktop: true, inbox: true, inAppUnread: !isActiveChannel, reason: "Desktop notification allowed." };
}

export const notificationService = {
  getPermission(): NotificationPermissionState {
    if (getNativeNotificationBridge()) {
      return nativeCapability === false ? "unsupported" : "system-controlled";
    }

    const NativeNotification = getNotificationConstructor();
    return NativeNotification ? NativeNotification.permission : "unsupported";
  },

  getStatus(): NotificationRuntimeStatus {
    const platform = platformService.getInfo();
    const nativeBridgeAvailable = Boolean(getNativeNotificationBridge());
    const permission = this.getPermission();
    const capability: NotificationCapability = nativeBridgeAvailable
      ? nativeCapability === true
        ? "native-available"
        : nativeCapability === false
          ? "native-unsupported"
          : "native-checking"
      : permission === "granted"
        ? "browser-granted"
        : permission === "denied"
          ? "browser-blocked"
          : permission === "default"
            ? "browser-permission-required"
            : "unsupported";
    const settings = settingsService.getSettings().notificationSettings;

    return {
      runtime: platform.runtime,
      platform: platform.platform,
      permission,
      capability,
      supported: capability === "native-available" || capability === "native-checking" || capability === "browser-granted" || capability === "browser-permission-required",
      nativeBridgeAvailable,
      requiresPermission: capability === "browser-permission-required",
      nativeDesktopEnabled: settings.nativeDesktopEnabled,
      soundEnabled: settings.soundEnabled,
      settings,
    };
  },

  async refreshStatus(): Promise<NotificationRuntimeStatus> {
    const nativeBridge = getNativeNotificationTestBridge();
    if (!getNativeNotificationBridge()) return this.getStatus();
    if (!nativeBridge?.getCapability) {
      nativeCapability = false;
      return this.getStatus();
    }
    try {
      const result = await nativeBridge.getCapability();
      nativeCapability = result.ok ? result.supported : false;
    } catch {
      nativeCapability = false;
    }
    return this.getStatus();
  },

  async requestPermission(): Promise<NotificationServiceResult> {
    if (getNativeNotificationBridge()) {
      const status = await this.refreshStatus();
      return status.capability === "native-available"
        ? { ok: true, permission: "system-controlled" }
        : { ok: false, reason: "Native notifications are unavailable in this runtime.", permission: status.permission };
    }

    const NativeNotification = getNotificationConstructor();

    if (!NativeNotification) {
      return { ok: false, reason: "Native notifications unavailable in this runtime.", permission: "unsupported" };
    }

    if (NativeNotification.permission === "default") {
      const permission = await NativeNotification.requestPermission();
      return { ok: permission === "granted", reason: permission === "granted" ? undefined : "Notification permission was not granted.", permission };
    }

    return {
      ok: NativeNotification.permission === "granted",
      reason: NativeNotification.permission === "granted" ? undefined : "Notification permission was not granted.",
      permission: NativeNotification.permission,
    };
  },

  async showNotification(payload: NativeNotificationPayload): Promise<NotificationServiceResult> {
    if (emergencyKillSwitchService.isActive("disableNativeNotifications")) {
      return { ok: false, reason: "Native notifications are temporarily unavailable.", permission: this.getPermission() };
    }

    const category = payload.category ?? "system";
    const route = decideNotificationRoute({ ...(payload.routing ?? {}), category });
    const settings = payload.routing?.settings ?? settingsService.getSettings().notificationSettings;
    const isMention = Boolean(payload.routing?.isMention || category === "mention");
    const quietHoursSilent = quietHoursShouldSilence(settings, isMention);
    const shouldBeSilent = payload.silent ?? (!settings.soundEnabled || quietHoursSilent);

    if (!route.desktop) {
      return { ok: false, reason: route.reason, permission: this.getPermission() };
    }

    if (!claimNativeNotification(payload)) {
      return { ok: false, reason: "Duplicate notification suppressed.", permission: this.getPermission() };
    }

    const nativeBridge = getNativeNotificationBridge();
    if (nativeBridge) {
      try {
        const result = await nativeBridge({
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          silent: shouldBeSilent,
          deepLink: payload.deepLink,
        });

        if (!result.ok) releaseNativeNotification(payload);
        return {
          ok: result.ok,
          reason: result.ok ? undefined : result.error,
          permission: this.getPermission(),
        };
      } catch {
        releaseNativeNotification(payload);
        return { ok: false, reason: "Native notification bridge failed safely.", permission: this.getPermission() };
      }
    }

    const permission = this.getPermission();
    if (permission !== "granted") {
      releaseNativeNotification(payload);
      return {
        ok: false,
        reason: permission === "default" ? "Notification permission requires an explicit user action." : "Notification permission was not granted.",
        permission,
      };
    }

    const NativeNotification = getNotificationConstructor();
    if (!NativeNotification) {
      releaseNativeNotification(payload);
      return { ok: false, reason: "Native notifications unavailable in this runtime.", permission: "unsupported" };
    }

    try {
      // Electron can later replace this path with a preload/native bridge while keeping this service API stable.
      const notification = new NativeNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        silent: shouldBeSilent,
      });
      if (payload.deepLink) notification.onclick = () => { deepLinkService.handleDeepLink(payload.deepLink as string); };
      return { ok: true, permission: NativeNotification.permission };
    } catch {
      releaseNativeNotification(payload);
      return { ok: false, reason: "Notification could not be shown by the current runtime.", permission: NativeNotification.permission };
    }
  },

  async showTestNotification(copy: NotificationTestCopy = { title: "PICOM", body: "Your desktop notifications are ready for testing." }): Promise<NotificationServiceResult> {
    if (emergencyKillSwitchService.isActive("disableNativeNotifications")) {
      return { ok: false, reason: "Native notifications are temporarily unavailable.", permission: this.getPermission() };
    }
    const settings = settingsService.getSettings().notificationSettings;
    if (!settings.enabled || !settings.nativeDesktopEnabled) {
      return { ok: false, reason: "Native desktop notifications are disabled in settings.", permission: this.getPermission() };
    }

    const nativeTest = getNativeNotificationTestBridge();
    if (getNativeNotificationBridge() && nativeTest?.sendTest) {
      const status = await this.refreshStatus();
      if (status.capability !== "native-available") {
        return { ok: false, reason: "Native notifications are unavailable in this runtime.", permission: status.permission };
      }
      try {
        const result = await nativeTest.sendTest();
        return { ok: result.ok, reason: result.ok ? undefined : result.error, permission: "system-controlled" };
      } catch {
        return { ok: false, reason: "Native notification test failed safely.", permission: "system-controlled" };
      }
    }

    if (getNativeNotificationBridge()) {
      return { ok: false, reason: "Native notification test is unavailable in this runtime.", permission: this.getPermission() };
    }

    const requested = await this.requestPermission();
    if (!requested.ok || requested.permission !== "granted") return requested;
    const NativeNotification = getNotificationConstructor();
    if (!NativeNotification) return { ok: false, reason: "Native notifications unavailable in this runtime.", permission: "unsupported" };
    try {
      new NativeNotification(copy.title, { body: copy.body, tag: "picom-test-notification", silent: !settings.soundEnabled });
      return { ok: true, permission: "granted" };
    } catch {
      return { ok: false, reason: "Notification could not be shown by the current runtime.", permission: "granted" };
    }
  },
};
