export type ScreenCaptureSource = PicomScreenCaptureSource;

export type ScreenCaptureServiceResult =
  | Readonly<{ ok: true; requestId: string; sources: ScreenCaptureSource[] }>
  | Readonly<{
      ok: false;
      error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_PERMISSION_DENIED" | "SCREEN_CAPTURE_NO_SOURCES" | "SCREEN_CAPTURE_SELECTION_EXPIRED" | "SCREEN_CAPTURE_FAILED";
      message: string;
      guidance: string;
      retryable: boolean;
    }>;

function isValidSource(source: PicomScreenCaptureSource): boolean {
  return /^(screen|window):[a-zA-Z0-9:_-]{1,240}$/.test(source.id) && Boolean(source.name && source.name.length <= 160 && (source.type === "screen" || source.type === "window"));
}

const createRequestId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
};

export const screenCaptureService = {
  async listSources(): Promise<ScreenCaptureServiceResult> {
    const getSources = window.picomDesktop?.screenCapture?.getSources;

    if (!getSources) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_UNAVAILABLE",
        message: "Screen capture is unavailable in this runtime.",
        guidance: "Open Picom in the Electron desktop app to share a screen or window.",
        retryable: false,
      };
    }

    const requestId = createRequestId();
    const result = await getSources({ requestId, userInitiated: true }).catch(() => null);

    if (!result?.ok) {
      const platform = result?.platform ?? window.picomDesktop?.getRuntimeInfo().platform ?? "unknown";
      const permissionDenied = result?.error === "SCREEN_CAPTURE_PERMISSION_DENIED";
      const noSources = result?.error === "SCREEN_CAPTURE_NO_SOURCES";
      const guidance = permissionDenied && platform === "darwin"
        ? "Open System Settings > Privacy & Security > Screen Recording, enable Picom, then restart Picom and try again."
        : platform === "linux"
          ? "Check your desktop portal or Wayland screen-sharing permission, then try loading sources again."
          : platform === "win32"
            ? "Close protected windows, confirm a display is connected, then try loading sources again."
            : "Review system screen-recording permissions and try again.";
      return {
        ok: false,
        error: permissionDenied ? "SCREEN_CAPTURE_PERMISSION_DENIED" : noSources ? "SCREEN_CAPTURE_NO_SOURCES" : "SCREEN_CAPTURE_FAILED",
        message: permissionDenied ? "Screen recording permission is required." : noSources ? "No shareable screens or windows were found." : "Picom could not load screen capture sources.",
        guidance,
        retryable: true,
      };
    }

    const sources = result.sources.filter(isValidSource).slice(0, 50);
    if (!sources.length) return { ok: false, error: "SCREEN_CAPTURE_NO_SOURCES", message: "No safe shareable sources were returned.", guidance: "Try loading sources again after opening the screen or window you want to share.", retryable: true };
    return { ok: true, requestId: result.requestId, sources };
  },

  async selectSource(requestId: string, sourceId: string): Promise<Readonly<{ ok: true; source: Pick<ScreenCaptureSource, "id" | "name" | "type"> }> | Readonly<{ ok: false; message: string; guidance: string; retryable: boolean }>> {
    const selectSource = window.picomDesktop?.screenCapture?.selectSource;
    if (!selectSource) return { ok: false, message: "Screen source validation is unavailable.", guidance: "Restart Picom in the Electron desktop app and choose the source again.", retryable: false };
    const result = await selectSource({ requestId, sourceId }).catch(() => null);
    if (!result || !result.ok) {
      const expired = result?.error === "SCREEN_CAPTURE_SELECTION_EXPIRED";
      return { ok: false, message: expired ? "The screen source selection expired." : "Picom could not validate the selected source.", guidance: "Choose the screen or window again before starting share.", retryable: true };
    }
    if (!isValidSource({ ...result.source, thumbnailDataUrl: null, appIconDataUrl: null })) return { ok: false, message: "Picom rejected an invalid screen source.", guidance: "Choose the screen or window again before starting share.", retryable: true };
    return { ok: true, source: result.source };
  },

  async cancelSelection(requestId: string): Promise<void> {
    await window.picomDesktop?.screenCapture?.cancelSelection({ requestId }).catch(() => undefined);
  }
};
