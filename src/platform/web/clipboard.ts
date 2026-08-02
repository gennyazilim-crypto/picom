import type { ClipboardAdapter } from "../types";
import { unavailable } from "./unsupported";

export const webClipboard: ClipboardAdapter = {
  async writeText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, data: true };
    } catch {
      return unavailable("CLIPBOARD_FAILED", "Clipboard write was blocked by the browser.");
    }
  },
  async readText() {
    try {
      return { ok: true, data: await navigator.clipboard.readText() };
    } catch {
      return unavailable("CLIPBOARD_FAILED", "Clipboard read was blocked by the browser.");
    }
  },
};
