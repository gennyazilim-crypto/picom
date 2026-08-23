import type { PlatformAdapter } from "../types";
import { getPlatformCapabilities } from "../detect";
import { desktopNotifications } from "./notifications";
import { desktopClipboard } from "./clipboard";
import { desktopFilePicker } from "./filePicker";
import { desktopWindow } from "./window";
import { desktopDeepLinks } from "./deepLinks";
import { desktopStorage } from "./storage";
import { desktopMedia } from "./media";
import { desktopScreenShare } from "./screenShare";

export function createDesktopPlatform(): PlatformAdapter {
  return {
    kind: "desktop",
    capabilities: getPlatformCapabilities("desktop"),
    notifications: desktopNotifications,
    clipboard: desktopClipboard,
    filePicker: desktopFilePicker,
    window: desktopWindow,
    deepLinks: desktopDeepLinks,
    storage: desktopStorage,
    media: desktopMedia,
    screenShare: desktopScreenShare,
  };
}
