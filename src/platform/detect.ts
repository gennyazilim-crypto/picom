import type { PlatformCapabilities, PlatformKind } from "./types";

export function detectPlatform(): PlatformKind {
  return typeof window !== "undefined" && window.picomDesktop ? "desktop" : "web";
}

export function getPlatformCapabilities(kind: PlatformKind = detectPlatform()): PlatformCapabilities {
  if (kind === "desktop") {
    return {
      notifications: true,
      clipboard: true,
      filePicker: true,
      windowControls: true,
      tray: true,
      companionNative: true,
      deepLinksNative: true,
      screenCaptureNative: true,
      screenCaptureBrowser: false,
      updates: true,
      activityPresence: true,
      pwa: false,
    };
  }
  return {
    notifications: typeof Notification !== "undefined",
    clipboard: typeof navigator !== "undefined" && Boolean(navigator.clipboard),
    filePicker: typeof document !== "undefined",
    windowControls: false,
    tray: false,
    companionNative: false,
    deepLinksNative: false,
    screenCaptureNative: false,
    screenCaptureBrowser: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia),
    updates: false,
    activityPresence: false,
    pwa: true,
  };
}
