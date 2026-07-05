import { platformService } from "./platformService";
import { settingsService, type NotificationSettings } from "./settingsService";

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

function getNotificationConstructor(): typeof Notification | null {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification : null;
}

function getNativeNotificationBridge() {
  return window.picomDesktop?.showNotification ?? null;
}

export function decideNotificationRoute(context: NotificationRouteContext): NotificationRouteDecision {
  const settings = context.settings ?? settingsService.getSettings().notificationSettings;
  const isActiveChannel = Boolean(context.activeChannelId && context.eventChannelId && context.activeChannelId === context.eventChannelId);
  const isMention = Boolean(context.isMention || context.category === "mention");

  if (!settings.enabled) {
    return { desktop: false, inbox: false, inAppUnread: false, reason: "Desktop notifications are disabled in settings." };
  }

  if (settings.muted || context.doNotDisturb) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Notifications are currently muted." };
  }

  if (settings.mentionsOnly && context.category === "message" && !isMention) {
    return { desktop: false, inbox: true, inAppUnread: !isActiveChannel, reason: "Only mention notifications are enabled." };
  }

  if ((context.channelMuted || context.communityMuted) && !isMention) {
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
    const category = payload.category ?? "system";
    const route = decideNotificationRoute({ ...(payload.routing ?? {}), category });

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
          silent: payload.silent,
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
        silent: payload.silent,
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
