export type ScreenCaptureSource = PicomScreenCaptureSource;

export type ScreenCaptureServiceResult =
  | Readonly<{ ok: true; sources: ScreenCaptureSource[] }>
  | Readonly<{ ok: false; error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_FAILED"; message: string }>;

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
        message: "Screen capture source selection is available in Electron desktop builds."
      };
    }

    const result = await getSources().catch(() => null);

    if (!result?.ok) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_FAILED",
        message: "Picom could not load screen capture sources."
      };
    }

    return {
      ok: true,
      sources: result.sources.filter(isValidSource)
    };
  }
};
