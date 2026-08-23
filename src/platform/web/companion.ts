import { desktopOnly } from "./unsupported";

/** Native companion window is Electron-only. */
export const webCompanion = {
  isAvailable: () => false,
  async enterMode() {
    return desktopOnly("Companion mode");
  },
  async returnToMain() {
    return desktopOnly("Companion mode");
  },
};