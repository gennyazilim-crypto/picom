import type { WindowAdapter } from "../types";
import { unavailable } from "./unavailable";

/** Thin wrapper around window.picomDesktop.windowControl(action). */
export const desktopWindow: WindowAdapter = {
  isAvailable: () => Boolean(window.picomDesktop?.windowControl),
  async minimize() {
    const control = window.picomDesktop?.windowControl;
    if (!control) return unavailable("Window controls unavailable.");
    const result = await control("minimize");
    return result.ok ? { ok: true, data: true } : unavailable(result.error ?? "Minimize failed.");
  },
  async maximize() {
    const control = window.picomDesktop?.windowControl;
    if (!control) return unavailable("Window controls unavailable.");
    const result = await control("maximize");
    return result.ok ? { ok: true, data: true } : unavailable(result.error ?? "Maximize failed.");
  },
  async close() {
    const control = window.picomDesktop?.windowControl;
    if (!control) return unavailable("Window controls unavailable.");
    const result = await control("close");
    return result.ok ? { ok: true, data: true } : unavailable(result.error ?? "Close failed.");
  },
};
