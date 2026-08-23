import { desktopOnly } from "./unsupported";

/** System tray is Electron-only; expose a honest stub for capability checks. */
export const webTray = {
  isAvailable: () => false,
  async setStatus() {
    return desktopOnly("System tray");
  },
};
