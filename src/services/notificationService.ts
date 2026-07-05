import { platformService } from "./platformService";
import { settingsService } from "./settingsService";

export type NotificationPermissionState = NotificationPermission | "unsupported";
export type NotificationCategory = "system" | "mention" | "message";

export interface NativeNotificationPayload {
  title: string;
  body?: string;
  category?: NotificationCategory;
  tag?: string;
  silent?: boolean;
}

export interface NotificationServiceResult {
  ok: boolean;
  reason?: string;
  permission?: NotificationPermissionState;
}

function getNotificationConstructor(): typeof Notification | null {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification : null;
}

function getNativeNotificationBridge() {
  return window.picomDesktop?.showNotification ?? null;
}

function isSuppressedBySettings(category: NotificationCategory): string | null {
  const settings = settingsService.getSettings().notificationSettings;

  if (!settings.enabled) return "Desktop notifications are disabled in settings.";
  if (settings.muted) return "Notifications are currently muted.";
  if (settings.mentionsOnly && category === "message") return "Only mention notifications are enabled.";

  return null;
}

export const notificationService = {
  getPermission(): NotificationPermissionState {
    const NativeNotification = getNotificationConstructor();
    return NativeNotification ? NativeNotification.permission : "unsupported";
  },

  getStatus() {
    const platform = platformService.getInfo();

    return {
      runtime: platform.runtime,
      platform: platform.platform,
      permission: this.getPermission(),
      supported: this.getPermission() !== "unsupported",
      nativeBridgeAvailable: Boolean(getNativeNotificationBridge()),
      settings: settingsService.getSettings().notificationSettings,
    };
  },

  async requestPermission(): Promise<NotificationServiceResult> {
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
    const suppressedReason = isSuppressedBySettings(category);

    if (suppressedReason) {
      return { ok: false, reason: suppressedReason, permission: this.getPermission() };
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
