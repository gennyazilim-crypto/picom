import type { ClipboardAdapter } from "../types";
import { unavailable } from "./unavailable";

export const desktopClipboard: ClipboardAdapter = {
  async writeText(text) {
    const write = window.picomDesktop?.clipboard?.writeText;
    if (write) {
      const result = await write(text);
      return result.ok ? { ok: true, data: true } : unavailable(result.error ?? "Clipboard write failed.");
    }
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, data: true };
    } catch {
      return unavailable("Clipboard write failed.");
    }
  },
  async readText() {
    const read = window.picomDesktop?.clipboard?.readText;
    if (read) {
      const result = await read();
      return result.ok ? { ok: true, data: result.text } : unavailable(result.error ?? "Clipboard read failed.");
    }
    try {
      return { ok: true, data: await navigator.clipboard.readText() };
    } catch {
      return unavailable("Clipboard read failed.");
    }
  },
};
