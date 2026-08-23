import type { WindowAdapter } from "../types";
import { desktopOnly } from "./unsupported";

/** Browser tabs have no OS window chrome — honest desktop-only failures. */
export const webWindow: WindowAdapter = {
  isAvailable: () => false,
  async minimize() {
    return desktopOnly("Window controls");
  },
  async maximize() {
    return desktopOnly("Window controls");
  },
  async close() {
    return desktopOnly("Window controls");
  },
};
