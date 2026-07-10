export type ScreenCaptureSource = PicomScreenCaptureSource;

export type ScreenCaptureServiceResult =
  | Readonly<{ ok: true; sources: ScreenCaptureSource[] }>
  | Readonly<{
      ok: false;
      error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_PERMISSION_DENIED" | "SCREEN_CAPTURE_NO_SOURCES" | "SCREEN_CAPTURE_FAILED";
      message: string;
      guidance: string;
      retryable: boolean;
    }>;

function isValidSource(source: PicomScreenCaptureSource): boolean {
  return Boolean(source.id && source.name && (source.type === "screen" || source.type === "window"));
}

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

    const result = await getSources().catch(() => null);

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

    return {
      ok: true,
      sources: result.sources.filter(isValidSource)
    };
  }
};
