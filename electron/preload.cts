import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, isIpcChannel } from "./ipcChannels.cjs";

type WindowAction = "minimize" | "maximize" | "close";
type MaximizeStateHandler = (isMaximized: boolean) => void;
type SafeScreenCaptureSource = Readonly<{
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnailDataUrl: string | null;
  appIconDataUrl: string | null;
}>;
type NativeNotificationPayload = Readonly<{
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
}>;
type TrayStatus = "online" | "idle" | "dnd" | "invisible";
type TrayAction = "open" | "settings" | "mute" | "quit" | TrayStatus;
type TrayActionPayload = Readonly<{
  action: TrayAction;
  status: TrayStatus;
  muted: boolean;
}>;
type PickedImageFile = Readonly<{
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}>;
type SaveTextPayload = Readonly<{
  defaultPath?: string;
  content: string;
}>;
type PowerResumePayload = Readonly<{
  timestamp: string;
}>;

type PicomRuntimeInfo = Readonly<{
  runtime: "electron";
  platform: string;
  versions: Readonly<{
    electron?: string;
    chrome?: string;
    node?: string;
  }>;
}>;

const safeDeepLinkSegmentPattern = /^[a-zA-Z0-9_-]{1,128}$/;

function isWindowAction(action: unknown): action is WindowAction {
  return action === "minimize" || action === "maximize" || action === "close";
}

function isTrayStatus(status: unknown): status is TrayStatus {
  return status === "online" || status === "idle" || status === "dnd" || status === "invisible";
}

function isTrayActionPayload(value: unknown): value is TrayActionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const action = record.action;
  const actionValid =
    action === "open" ||
    action === "settings" ||
    action === "mute" ||
    action === "quit" ||
    isTrayStatus(action);

  return actionValid && isTrayStatus(record.status) && typeof record.muted === "boolean";
}

function invokeWhitelisted(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!isIpcChannel(channel)) {
    return Promise.resolve({ ok: false, native: true, error: "IPC_CHANNEL_NOT_ALLOWED" });
  }

  return ipcRenderer.invoke(channel, ...args);
}

function isSafeDeepLinkSegment(value: string | undefined): value is string {
  return Boolean(value && safeDeepLinkSegmentPattern.test(value));
}

function isSupportedPicomDeepLink(parsed: URL): boolean {
  if (parsed.protocol !== "picom:" || parsed.username || parsed.password || parsed.hash) {
    return false;
  }

  const route = parsed.hostname;
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (route === "auth" && segments.length === 1 && segments[0] === "callback") {
    const allowedKeys = new Set(["code", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }

  if (route === "auth" && segments.length === 1 && segments[0] === "reset-password") {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const type = parsed.searchParams.get("type");
    if (type && type !== "recovery") return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }
  if (route === "auth" && segments.length === 1 && segments[0] === "verify-email") {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const type = parsed.searchParams.get("type");
    if (type && type !== "signup" && type !== "email_change") return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }

  if (parsed.search) return false;

  if (route === "invite") {
    return segments.length === 1 && isSafeDeepLinkSegment(segments[0]);
  }

  if (route === "community") {
    const [communityId, channelKeyword, channelId, messageKeyword, messageId] = segments;
    if (!isSafeDeepLinkSegment(communityId)) return false;
    if (segments.length === 1) return true;
    if (segments.length === 3) return channelKeyword === "channel" && isSafeDeepLinkSegment(channelId);
    if (segments.length === 5) {
      return (
        channelKeyword === "channel" &&
        isSafeDeepLinkSegment(channelId) &&
        messageKeyword === "message" &&
        isSafeDeepLinkSegment(messageId)
      );
    }
  }

  if ((route === "radio" || route === "podcast") && segments.length === 3) {
    const expectedKind = route === "radio" ? "session" : "episode";
    return segments[1] === expectedKind && isSafeDeepLinkSegment(segments[0]) && isSafeDeepLinkSegment(segments[2]);
  }

  return (route === "settings" || route === "friends") && segments.length === 0;
}

function isSafeDeepLink(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2048) {
    return false;
  }

  try {
    return isSupportedPicomDeepLink(new URL(value));
  } catch {
    return false;
  }
}

function isPowerResumePayload(value: unknown): value is PowerResumePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return typeof (value as { timestamp?: unknown }).timestamp === "string";
}

const runtimeInfo: PicomRuntimeInfo = Object.freeze({
  runtime: "electron",
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  })
});

const bridge = Object.freeze({
  contractVersion: 1 as const,
  getRuntimeInfo: (): PicomRuntimeInfo => runtimeInfo,
  windowControl: (action: WindowAction) => {
    if (!isWindowAction(action)) {
      return Promise.resolve({ ok: false, native: true, error: "INVALID_WINDOW_ACTION" } as const);
    }

    return invokeWhitelisted(IPC_CHANNELS.windowControl, action) as Promise<
      | { ok: true; native: true; action: WindowAction; maximized: boolean }
      | { ok: false; native: true; error: string }
    >;
  },
  isWindowMaximized: async (): Promise<boolean> => {
    const result = await invokeWhitelisted(IPC_CHANNELS.windowIsMaximized);

    if (typeof result !== "object" || result === null || !("maximized" in result)) {
      return false;
    }

    return Boolean((result as { maximized?: unknown }).maximized);
  },
  onWindowMaximizeStateChanged: (callback: MaximizeStateHandler) => {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
      callback(Boolean(value));
    };

    ipcRenderer.on(IPC_CHANNELS.windowMaximizeStateChanged, listener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowMaximizeStateChanged, listener);
    };
  },
  screenCapture: {
    getSources: () =>
      invokeWhitelisted(IPC_CHANNELS.screenCaptureGetSources) as Promise<
        | { ok: true; native: true; sources: SafeScreenCaptureSource[] }
        | { ok: false; native: true; error: string; platform?: string }
      >
  },
  showNotification: (payload: NativeNotificationPayload) =>
    invokeWhitelisted(IPC_CHANNELS.notificationShow, payload) as Promise<
      | { ok: true; native: true }
      | { ok: false; native: true; error: string }
    >,
  tray: {
    setStatus: (status: TrayStatus) => {
      if (!isTrayStatus(status)) {
        return Promise.resolve({ ok: false, native: true, error: "INVALID_TRAY_STATUS" } as const);
      }

      return invokeWhitelisted(IPC_CHANNELS.traySetStatus, status) as Promise<
        | { ok: true; native: true; status: TrayStatus }
        | { ok: false; native: true; error: string }
      >;
    },
    setMuted: (muted: boolean) =>
      invokeWhitelisted(IPC_CHANNELS.traySetMuted, muted) as Promise<
        | { ok: true; native: true; muted: boolean }
        | { ok: false; native: true; error: string }
      >,
    setCloseToTray: (enabled: boolean) =>
      invokeWhitelisted(IPC_CHANNELS.traySetCloseToTray, enabled) as Promise<
        | { ok: true; native: true; enabled: boolean; supported: boolean }
        | { ok: false; native: true; error: string }
      >,
    showWindow: () =>
      invokeWhitelisted(IPC_CHANNELS.trayShowWindow) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    quit: () =>
      invokeWhitelisted(IPC_CHANNELS.trayQuit) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    onAction: (callback: (payload: TrayActionPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isTrayActionPayload(value)) {
          callback(value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.trayAction, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.trayAction, listener);
      };
    }
  },
  startup: {
    getState: () => invokeWhitelisted(IPC_CHANNELS.startupGetState) as Promise<
      | { ok: true; native: true; supported: boolean; enabled: boolean }
      | { ok: false; native: true; error: string }
    >,
    setEnabled: (enabled: boolean) => invokeWhitelisted(IPC_CHANNELS.startupSetEnabled, enabled) as Promise<
      | { ok: true; native: true; supported: true; enabled: boolean }
      | { ok: false; native: true; error: string }
    >
  },
  file: {
    pickImages: () =>
      invokeWhitelisted(IPC_CHANNELS.filePickImages) as Promise<
        | { ok: true; native: true; canceled: boolean; files: PickedImageFile[] }
        | { ok: false; native: true; error: string }
      >,
    saveText: (payload: SaveTextPayload) =>
      invokeWhitelisted(IPC_CHANNELS.fileSaveText, payload) as Promise<
        | { ok: true; native: true; canceled: boolean }
        | { ok: false; native: true; error: string }
      >
  },
  clipboard: {
    readText: () =>
      invokeWhitelisted(IPC_CHANNELS.clipboardReadText) as Promise<
        | { ok: true; native: true; text: string }
        | { ok: false; native: true; error: string }
      >,
    writeText: (text: string) =>
      invokeWhitelisted(IPC_CHANNELS.clipboardWriteText, text) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >
  },
  externalLinks: {
    openUrl: (url: string) =>
      invokeWhitelisted(IPC_CHANNELS.externalOpenUrl, url) as Promise<
        | { ok: true; native: true; url: string }
        | { ok: false; native: true; error: string }
      >
  },
  deepLinks: {
    onOpen: (callback: (url: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isSafeDeepLink(value)) {
          callback(value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.deepLinkOpen, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.deepLinkOpen, listener);
      };
    }
  },
  power: {
    onResume: (callback: (payload: PowerResumePayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isPowerResumePayload(value)) {
          callback(value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.powerResume, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.powerResume, listener);
      };
    }
  }
});

contextBridge.exposeInMainWorld("picomDesktop", Object.freeze(bridge));
