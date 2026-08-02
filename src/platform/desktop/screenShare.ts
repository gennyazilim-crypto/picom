import type { ScreenShareAdapter } from "../types";
import { unavailable } from "./unavailable";

export const desktopScreenShare: ScreenShareAdapter = {
  mode: "native",
  async listSources() {
    const getSources = window.picomDesktop?.screenCapture?.getSources;
    if (!getSources) return unavailable("Screen capture unavailable.");
    const requestId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `desktop-${Date.now()}`;
    const result = await getSources({ requestId, userInitiated: true }).catch(() => null);
    if (!result?.ok) return unavailable("Could not list screen sources.");
    return {
      ok: true,
      data: result.sources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type,
      })),
    };
  },
  async acquireDisplayMedia() {
    return unavailable("Use the native screen picker on desktop.");
  },
};
