import { platformService } from "./platformService";
import { settingsService, type NotificationSettings, type QuietHoursSettings } from "./settingsService";
import { notificationDigestService } from "./notificationDigestService";
import { emergencyKillSwitchService } from "./emergencyKillSwitchService";
import { notificationPolicyStateService } from "./notificationPolicyStateService";

export type NotificationPermissionState = NotificationPermission | "unsupported";
export type NotificationCategory = "system" | "mention" | "message";

export interface NativeNotificationPayload {
  title: string;
  body?: string;
  category?: NotificationCategory;
  tag?: string;
  silent?: boolean;
  routing?: Omit<NotificationRouteContext, "category">;
}

export interface NotificationServiceResult {
  ok: boolean;
  reason?: string;
  permission?: NotificationPermissionState;
}

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
  doNotDisturb?: boolean;
  settings?: NotificationSettings;
}

export interface NotificationRouteDecision {
  desktop: boolean;
  inbox: boolean;
  inAppUnread: boolean;
  reason: string;
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
  if (settings.quietHours.applyTo === "normal_messages_only") return category === "message" && !isMention;
  return false;
}

export function quietHoursShouldSilence(settings: NotificationSettings, isMention: boolean, now = new Date()): boolean {
  return isQuietHoursActive(settings.quietHours, now)
    && settings.quietHours.applyTo === "sounds_only_placeholder"
    && !(isMention && settings.quietHours.allowMentions);
}

function getNotificationConstructor(): typeof Notification | null {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification : null;
}

function getNativeNotificationBridge() {
  return window.picomDesktop?.showNotification ?? null;
}

export function decideNotificationRoute(context: NotificationRouteContext): NotificationRouteDecision {
  const settings = context.settings ?? settingsService.getSettings().notificationSettings;
  const policyState = notificationPolicyStateService.getSnapshot();
  const isActiveChannel = Boolean(context.activeChannelId && context.eventChannelId && context.activeChannelId === context.eventChannelId);
  const isMention = Boolean(context.isMention || context.category === "mention");
  const doNotDisturb = Boolean(settings.muted || context.doNotDisturb || policyState.doNotDisturb);
  const channelMuted = Boolean(context.channelMuted || notificationPolicyStateService.isChannelMuted(context.channelId ?? context.eventChannelId));
  const communityMuted = Boolean(context.communityMuted || notificationPolicyStateService.isCommunityMuted(context.communityId));

  if (!settings.enabled) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "Desktop notifications are disabled in settings." };
  }

  if (doNotDisturb) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Notifications are currently muted." };
  }

  if (quietHoursSuppressesDesktop(settings, isMention, context.category)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Quiet Hours suppressed this desktop notification." };
  }

  if (settings.mentionsOnly && context.category === "message" && !isMention) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Only mention notifications are enabled." };
  }

  if (notificationDigestService.shouldDigestNotification(settings, context.category, isMention)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Notification digest placeholder grouped this normal message." };
  }

  if ((channelMuted || communityMuted) && (!isMention || !settings.allowMentionsFromMutedScopes)) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Muted channel or community suppressed this notification." };
  }

  if (context.appFocused && isActiveChannel && context.isNearBottom) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "User is already reading the active channel." };
  }

  if (context.appFocused && isActiveChannel) {
    return { desktop: false, inbox: true, inAppUnread: true, reason: "Active channel notification routed in-app." };
  }

  return { desktop: true, inbox: true, inAppUnread: !isActiveChannel, reason: "Desktop notification allowed." };
}

export const notificationService = {
  getPermission(): NotificationPermissionState {
    if (getNativeNotificationBridge()) {
      return "granted";
    }

    const NativeNotification = getNotificationConstructor();
    return NativeNotification ? NativeNotification.permission : "unsupported";
  },

  getStatus() {
    const platform = platformService.getInfo();

    return {
      runtime: platform.runtime,
      platform: platform.platform,
      permission: this.getPermission(),
      supported: Boolean(getNativeNotificationBridge()) || this.getPermission() !== "unsupported",
      nativeBridgeAvailable: Boolean(getNativeNotificationBridge()),
      settings: settingsService.getSettings().notificationSettings,
    };
  },

  async requestPermission(): Promise<NotificationServiceResult> {
    if (getNativeNotificationBridge()) {
      return { ok: true, permission: "granted" };
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

    if (!route.desktop) {
      return { ok: false, reason: route.reason, permission: this.getPermission() };
    }

    const nativeBridge = getNativeNotificationBridge();
    if (nativeBridge) {
      try {
        const result = await nativeBridge({
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          silent: payload.silent ?? quietHoursSilent,
        });

        return {
          ok: result.ok,
          reason: result.ok ? undefined : result.error,
          permission: this.getPermission(),
        };
      } catch {
        return { ok: false, reason: "Native notification bridge failed safely.", permission: this.getPermission() };
      }
    }

    const permission = await this.requestPermission();
    if (!permission.ok) return permission;

    const NativeNotification = getNotificationConstructor();
    if (!NativeNotification) {
      return { ok: false, reason: "Native notifications unavailable in this runtime.", permission: "unsupported" };
    }

    try {
      // Electron can later replace this path with a preload/native bridge while keeping this service API stable.
      new NativeNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        silent: payload.silent ?? quietHoursSilent,
      });
      return { ok: true, permission: NativeNotification.permission };
    } catch {
      return { ok: false, reason: "Notification could not be shown by the current runtime.", permission: NativeNotification.permission };
    }
  },

  async showTestNotification() {
    return this.showNotification({
      title: "Picom",
      body: "Desktop notification placeholder is working.",
      category: "system",
      tag: "picom-test-notification",
    });
  },
};
