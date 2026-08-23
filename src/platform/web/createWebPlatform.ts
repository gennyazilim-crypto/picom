import type {
  PlatformAdapter,
} from "../types";
import { getPlatformCapabilities } from "../detect";
import { webNotifications } from "./notifications";
import { webClipboard } from "./clipboard";
import { webFilePicker } from "./filePicker";
import { webWindow } from "./window";
import { webDeepLinks } from "./deepLinks";
import { webStorage } from "./storage";
import { webMedia } from "./media";
import { webScreenShare } from "./screenShare";

export function createWebPlatform(): PlatformAdapter {
  return {
    kind: "web",
    capabilities: getPlatformCapabilities("web"),
    notifications: webNotifications,
    clipboard: webClipboard,
    filePicker: webFilePicker,
    window: webWindow,
    deepLinks: webDeepLinks,
    storage: webStorage,
    media: webMedia,
    screenShare: webScreenShare,
  };
}

export {
  webNotifications,
  webClipboard,
  webFilePicker,
  webWindow,
  webDeepLinks,
  webStorage,
  webMedia,
  webScreenShare,
};
