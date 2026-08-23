import { acquireElectronDesktopCaptureStream } from "../utils/electronDesktopCapture";

export type ScreenCaptureSource = PicomScreenCaptureSource;

export type ScreenCaptureServiceResult =
  | Readonly<{
      ok: true;
      requestId: string;
      sources: ScreenCaptureSource[];
      diagnostics?: Readonly<{
        displayCount: number;
        screenSourceCount: number;
        windowSourceCount?: number;
        incompleteDisplays: boolean;
      }>;
    }>
  | Readonly<{
      ok: false;
      error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_PERMISSION_DENIED" | "SCREEN_CAPTURE_NO_SOURCES" | "SCREEN_CAPTURE_SELECTION_EXPIRED" | "SCREEN_CAPTURE_FAILED";
      message: string;
      guidance: string;
      retryable: boolean;
    }>;

export type BrowserDisplayMediaResult =
  | Readonly<{ ok: true; stream: MediaStream; sourceId: "browser:display" }>
  | Readonly<{
      ok: false;
      error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_PERMISSION_DENIED" | "SCREEN_CAPTURE_FAILED";
      message: string;
      guidance: string;
      retryable: boolean;
    }>;

const BROWSER_DISPLAY_ID = "browser:display" as const;

function isValidSource(source: PicomScreenCaptureSource): boolean {
  if (source.id === BROWSER_DISPLAY_ID && source.type === "screen" && source.name) return true;
  return /^(screen|window):[a-zA-Z0-9:_\\.\-]{1,240}$/.test(source.id) && Boolean(source.name && source.name.length <= 160 && (source.type === "screen" || source.type === "window"));
}

const createRequestId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
};

function browserDisplayAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

function looksLikeElectronShellWithoutBridge(): boolean {
  if (typeof navigator === "undefined") return false;
  if (window.picomDesktop) return false;
  return /\bElectron\//i.test(navigator.userAgent);
}

export const screenCaptureService = {
  async listSources(): Promise<ScreenCaptureServiceResult> {
    const getSources = window.picomDesktop?.screenCapture?.getSources;

    if (!getSources) {
      // Electron shell without the capture bridge should not pretend to be the web picker.
      if (window.picomDesktop || looksLikeElectronShellWithoutBridge()) {
        return {
          ok: false,
          error: "SCREEN_CAPTURE_UNAVAILABLE",
          message: "Native screen capture is unavailable in this Picom window.",
          guidance: "Fully quit Picom Desktop and reopen with npm run electron:dev (or the installed app). Browser / Cursor preview cannot list Chrome or Picom windows.",
          retryable: true,
        };
      }
      if (browserDisplayAvailable()) {
        return {
          ok: true,
          requestId: createRequestId(),
          sources: [
            {
              id: BROWSER_DISPLAY_ID,
              name: "Windows screen & window picker",
              type: "screen",
              thumbnailDataUrl: null,
              appIconDataUrl: null,
            },
          ],
          diagnostics: {
            displayCount: 0,
            screenSourceCount: 0,
            windowSourceCount: 0,
            incompleteDisplays: false,
          },
        };
      }
      return {
        ok: false,
        error: "SCREEN_CAPTURE_UNAVAILABLE",
        message: "Screen capture is unavailable in this runtime.",
        guidance: "Open Picom Desktop to list every monitor, or use a browser that supports screen sharing.",
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
            ? result?.error === "SCREEN_CAPTURE_USER_ACTION_REQUIRED"
              ? "Click inside the Picom Desktop window, then try loading sources again."
              : "Close protected windows, confirm a display is connected, then try loading sources again."
            : result?.error === "SCREEN_CAPTURE_USER_ACTION_REQUIRED"
              ? "Focus the Picom window, then try loading sources again."
              : "Review system screen-recording permissions and try again.";
      return {
        ok: false,
        error: permissionDenied
          ? "SCREEN_CAPTURE_PERMISSION_DENIED"
          : noSources
            ? "SCREEN_CAPTURE_NO_SOURCES"
            : result?.error === "SCREEN_CAPTURE_USER_ACTION_REQUIRED"
              ? "SCREEN_CAPTURE_FAILED"
              : "SCREEN_CAPTURE_FAILED",
        message: permissionDenied
          ? "Screen recording permission is required."
          : noSources
            ? "No shareable screens or windows were found."
            : result?.error === "SCREEN_CAPTURE_USER_ACTION_REQUIRED"
              ? "Picom needs the desktop window focused to list screens and windows."
              : "Picom could not load screen capture sources.",
        guidance,
        retryable: true,
      };
    }

    const sources = result.sources.filter(isValidSource).slice(0, 50);
    if (!sources.length) return { ok: false, error: "SCREEN_CAPTURE_NO_SOURCES", message: "No safe shareable sources were returned.", guidance: "Try loading sources again after opening the screen or window you want to share.", retryable: true };
    return {
      ok: true,
      requestId: result.requestId,
      sources,
      diagnostics: result.diagnostics,
    };
  },

  async selectSource(requestId: string, sourceId: string): Promise<Readonly<{ ok: true; source: Pick<ScreenCaptureSource, "id" | "name" | "type"> }> | Readonly<{ ok: false; message: string; guidance: string; retryable: boolean }>> {
    if (sourceId === BROWSER_DISPLAY_ID && !window.picomDesktop?.screenCapture?.selectSource) {
      if (!browserDisplayAvailable()) {
        return { ok: false, message: "Browser screen sharing is unavailable.", guidance: "Use a supported browser or the Picom desktop app.", retryable: false };
      }
      return { ok: true, source: { id: BROWSER_DISPLAY_ID, name: "Windows screen & window picker", type: "screen" } };
    }

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

  /**
   * Browser-only path: prompt via getDisplayMedia (requires a user gesture).
   * Returns a synthetic source id `browser:display` for web share flows.
   */
  async acquireBrowserDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<BrowserDisplayMediaResult> {
    if (window.picomDesktop?.screenCapture) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_UNAVAILABLE",
        message: "Use the native screen picker in the desktop app.",
        guidance: "Desktop screen sharing uses the Electron source list, not getDisplayMedia.",
        retryable: false,
      };
    }
    if (!browserDisplayAvailable()) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_UNAVAILABLE",
        message: "Screen capture is unavailable in this browser.",
        guidance: "Use a browser that supports display media, or open Picom Desktop.",
        retryable: false,
      };
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(
        constraints ?? {
          video: { frameRate: 30, width: { max: 1920 }, height: { max: 1080 } },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        },
      );
      return { ok: true, stream, sourceId: BROWSER_DISPLAY_ID };
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      return {
        ok: false,
        error: denied ? "SCREEN_CAPTURE_PERMISSION_DENIED" : "SCREEN_CAPTURE_FAILED",
        message: denied ? "Screen share permission was denied or cancelled." : "Picom could not start browser screen capture.",
        guidance: denied ? "Allow screen sharing when the browser prompts, then try again." : "Retry after closing other capture sessions.",
        retryable: true,
      };
    }
  },

  async cancelSelection(requestId: string): Promise<void> {
    await window.picomDesktop?.screenCapture?.cancelSelection({ requestId }).catch(() => undefined);
  },

  /**
   * Electron desktop preview/publish acquire — video-only by default for Go Live preview.
   * Does not publish; caller owns stop()/lifecycle.
   */
  async acquireElectronDesktopMedia(
    sourceId: string,
    options: Readonly<{ includeAudio?: boolean }> = {},
  ): Promise<
    | Readonly<{ ok: true; stream: MediaStream }>
    | Readonly<{ ok: false; error: "SCREEN_CAPTURE_UNAVAILABLE" | "SCREEN_CAPTURE_FAILED"; message: string; guidance: string; retryable: boolean }>
  > {
    if (!window.picomDesktop?.screenCapture) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_UNAVAILABLE",
        message: "Native desktop capture is unavailable in this window.",
        guidance: "Open Picom Desktop to preview a screen or window source.",
        retryable: false,
      };
    }
    if (!/^(screen|window):[a-zA-Z0-9:_\\.\-]{1,240}$/.test(sourceId)) {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_FAILED",
        message: "The selected screen source is invalid or expired.",
        guidance: "Refresh sources and choose the screen or window again.",
        retryable: true,
      };
    }
    try {
      const stream = await acquireElectronDesktopCaptureStream(sourceId, {
        includeAudio: options.includeAudio === true,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      });
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== "live") {
        stream.getTracks().forEach((item) => item.stop());
        return {
          ok: false,
          error: "SCREEN_CAPTURE_FAILED",
          message: "Desktop capture returned no live video track.",
          guidance: "Choose the screen or window again, then retry preview.",
          retryable: true,
        };
      }
      return { ok: true, stream };
    } catch {
      return {
        ok: false,
        error: "SCREEN_CAPTURE_FAILED",
        message: "Picom could not open a local preview for that source.",
        guidance: "Close other capture sessions, refresh sources, and try again.",
        retryable: true,
      };
    }
  },
};
