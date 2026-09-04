import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, isIpcChannel } from "./ipcChannels.cjs";
import { parseScreenCaptureCancelPayload, parseScreenCaptureListPayload, parseScreenCaptureSelectionPayload } from "./ipcPayloadValidation.cjs";

type WindowAction = "minimize" | "maximize" | "close";
type MaximizeStateHandler = (isMaximized: boolean) => void;
type SafeScreenCaptureSource = Readonly<{
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnailDataUrl: string | null;
  appIconDataUrl: string | null;
}>;
type ScreenCaptureDiagnostics = Readonly<{
  displayCount: number;
  screenSourceCount: number;
  windowSourceCount?: number;
  incompleteDisplays: boolean;
}>;
type ScreenCaptureListRequest = Readonly<{ requestId: string; userInitiated: true }>;
type ScreenCaptureSelectionRequest = Readonly<{ requestId: string; sourceId: string }>;
type NativeNotificationPayload = Readonly<{
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  deepLink?: string;
}>;
type IncomingCallToastPayload = Readonly<{
  inviteId: string;
  callerName: string;
  subtitle: string;
  avatarUrl?: string;
}>;
type IncomingCallToastAction = "accept" | "decline" | "message";
type IncomingCallActionPayload = Readonly<{
  action: IncomingCallToastAction;
  inviteId: string;
}>;
type DesktopNotificationToastAction = "open" | "dismiss" | "accept" | "decline" | "message" | "watch-live";
type DesktopNotificationToastPayload = Readonly<{
  notificationId: string;
  type: "friend-request" | "friend-accepted" | "dm" | "friend-online" | "live";
  title: string;
  body: string;
  closeLabel: string;
  soundEnabled: boolean;
  accent: "indigo" | "teal" | "rose";
  primaryAction?: Readonly<{ action: Exclude<DesktopNotificationToastAction, "dismiss">; label: string }>;
  secondaryAction?: Readonly<{ action: Exclude<DesktopNotificationToastAction, "dismiss">; label: string }>;
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

type UpdaterState = Readonly<{
  status: string;
  enabled: boolean;
  version: string | null;
  releaseChannel: string;
  message: string;
  progress: number | null;
  checkedAt: string | null;
}>;

function isUpdaterState(value: unknown): value is UpdaterState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.status === "string" &&
    typeof record.enabled === "boolean" &&
    (record.version === null || typeof record.version === "string") &&
    typeof record.releaseChannel === "string" &&
    typeof record.message === "string" &&
    (record.progress === null || typeof record.progress === "number") &&
    (record.checkedAt === null || typeof record.checkedAt === "string")
  );
}

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

function isDesktopNotificationToastPayload(value: unknown): value is DesktopNotificationToastPayload {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  const id = input.notificationId;
  const type = input.type;
  const accent = input.accent;
  const validId = typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id);
  const validType = type === "friend-request" || type === "friend-accepted" || type === "dm" || type === "friend-online" || type === "live";
  const validAccent = accent === "indigo" || accent === "teal" || accent === "rose";
  const validText = typeof input.title === "string" && input.title.length <= 160 && typeof input.body === "string" && input.body.length <= 320 && typeof input.closeLabel === "string" && input.closeLabel.length <= 80 && typeof input.soundEnabled === "boolean";
  const validAction = (candidate: unknown): boolean => candidate === undefined || (
    typeof candidate === "object" && candidate !== null
    && typeof (candidate as Record<string, unknown>).label === "string"
    && ((candidate as Record<string, unknown>).action === "open" || (candidate as Record<string, unknown>).action === "accept" || (candidate as Record<string, unknown>).action === "decline" || (candidate as Record<string, unknown>).action === "message" || (candidate as Record<string, unknown>).action === "watch-live")
  );
  return validId && validType && validAccent && validText && validAction(input.primaryAction) && validAction(input.secondaryAction);
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

  if (route === "profile" || route === "live-now") {
    return segments.length === 1 && isSafeDeepLinkSegment(segments[0]);
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
  companion: Object.freeze({
    getContext: () => invokeWhitelisted(IPC_CHANNELS.companionGetContext),
    enterMode: () => invokeWhitelisted(IPC_CHANNELS.companionEnterMode),
    openWindow: (request: unknown) => invokeWhitelisted(IPC_CHANNELS.companionOpenWindow, request),
    closeCurrent: () => invokeWhitelisted(IPC_CHANNELS.companionCloseWindow),
    returnToMain: () => invokeWhitelisted(IPC_CHANNELS.companionReturnToMain),
    getPreferences: () => invokeWhitelisted(IPC_CHANNELS.companionGetPreferences),
    setPreferences: (preferences: unknown) => invokeWhitelisted(IPC_CHANNELS.companionSetPreferences, preferences),
    setAlwaysOnTop: (enabled: boolean) => invokeWhitelisted(IPC_CHANNELS.companionSetAlwaysOnTop, enabled),
    setDockLayout: (layout: unknown) => invokeWhitelisted(IPC_CHANNELS.companionSetDockLayout, layout),
    setWindowBounds: (bounds: unknown) => invokeWhitelisted(IPC_CHANNELS.companionSetWindowBounds, bounds),
    setClickThrough: (enabled: boolean) => invokeWhitelisted(IPC_CHANNELS.companionSetClickThrough, enabled),
    broadcast: (event: unknown) => invokeWhitelisted(IPC_CHANNELS.companionBroadcast, event),
    onSync: (listener: (event: Readonly<{ topic: string; revision: number }>) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: Readonly<{ topic: string; revision: number }>) => listener(payload);
      ipcRenderer.on(IPC_CHANNELS.companionEvent, wrapped);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.companionEvent, wrapped);
    },
  }),
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
    getSources: (request: ScreenCaptureListRequest) => {
      const safeRequest = parseScreenCaptureListPayload(request);
      if (!safeRequest) return Promise.resolve({ ok: false, native: true, error: "INVALID_SCREEN_CAPTURE_REQUEST" } as const);
      return invokeWhitelisted(IPC_CHANNELS.screenCaptureGetSources, safeRequest) as Promise<
        | {
            ok: true;
            native: true;
            requestId: string;
            sources: SafeScreenCaptureSource[];
            diagnostics?: ScreenCaptureDiagnostics;
          }
        | { ok: false; native: true; error: string; platform?: string }
      >;
    },
    selectSource: (request: ScreenCaptureSelectionRequest) => {
      const safeRequest = parseScreenCaptureSelectionPayload(request);
      if (!safeRequest) return Promise.resolve({ ok: false, native: true, error: "INVALID_SCREEN_CAPTURE_SELECTION" } as const);
      return invokeWhitelisted(IPC_CHANNELS.screenCaptureSelectSource, safeRequest) as Promise<
        | { ok: true; native: true; source: Pick<SafeScreenCaptureSource, "id" | "name" | "type"> }
        | { ok: false; native: true; error: string }
      >;
    },
    cancelSelection: (request: Readonly<{ requestId: string }>) => {
      const safeRequest = parseScreenCaptureCancelPayload(request);
      if (!safeRequest) return Promise.resolve({ ok: false, native: true, error: "INVALID_SCREEN_CAPTURE_CANCEL" } as const);
      return invokeWhitelisted(IPC_CHANNELS.screenCaptureCancelSelection, safeRequest) as Promise<
        | { ok: true; native: true; canceled: true }
        | { ok: false; native: true; error: string }
      >;
    },
    setContentProtection: (enabled: boolean) =>
      invokeWhitelisted(IPC_CHANNELS.screenCaptureSetContentProtection, { enabled: Boolean(enabled) }) as Promise<
        | { ok: true; native: true; enabled: boolean }
        | { ok: false; native: true; error: string }
      >,
  },
  showNotification: (payload: NativeNotificationPayload) =>
    invokeWhitelisted(IPC_CHANNELS.notificationShow, payload) as Promise<
      | { ok: true; native: true }
      | { ok: false; native: true; error: string }
    >,
  notifications: {
    getCapability: () =>
      invokeWhitelisted(IPC_CHANNELS.notificationGetCapability) as Promise<
        | { ok: true; native: true; supported: boolean }
        | { ok: false; native: true; error: string }
      >,
    /** Fixed-content, payload-free native notification test. */
    sendTest: () =>
      invokeWhitelisted(IPC_CHANNELS.notificationSendTest) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
  },
  desktopNotificationToast: {
    show: (payload: DesktopNotificationToastPayload) => {
      if (!isDesktopNotificationToastPayload(payload)) return Promise.resolve({ ok: false, native: true, error: "INVALID_DESKTOP_NOTIFICATION_TOAST" } as const);
      return invokeWhitelisted(IPC_CHANNELS.desktopNotificationToastShow, payload) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >;
    },
    act: (payload: Readonly<{ action: DesktopNotificationToastAction; notificationId: string }>) =>
      invokeWhitelisted(IPC_CHANNELS.desktopNotificationToastAction, payload) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    onAction: (callback: (payload: Readonly<{ action: DesktopNotificationToastAction; notificationId: string }>) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (typeof record.notificationId === "string" && (record.action === "open" || record.action === "dismiss" || record.action === "accept" || record.action === "decline" || record.action === "message" || record.action === "watch-live")) callback({ action: record.action, notificationId: record.notificationId });
      };
      ipcRenderer.on(IPC_CHANNELS.desktopNotificationToastEvent, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.desktopNotificationToastEvent, listener);
    },
  },
  incomingCall: {
    show: (payload: IncomingCallToastPayload) =>
      invokeWhitelisted(IPC_CHANNELS.incomingCallShow, payload) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    dismiss: () =>
      invokeWhitelisted(IPC_CHANNELS.incomingCallDismiss) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    respond: (action: IncomingCallToastAction) =>
      invokeWhitelisted(IPC_CHANNELS.incomingCallRespond, action) as Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >,
    onAction: (callback: (payload: IncomingCallActionPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (
          (record.action === "accept" || record.action === "decline" || record.action === "message")
          && typeof record.inviteId === "string"
        ) {
          callback({ action: record.action, inviteId: record.inviteId });
        }
      };
      ipcRenderer.on(IPC_CHANNELS.incomingCallAction, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.incomingCallAction, listener);
      };
    },
  },
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
  },
  updates: {
    getState: () =>
      invokeWhitelisted(IPC_CHANNELS.updateGetState) as Promise<
        | { ok: true; native: true; state: UpdaterState }
        | { ok: false; native: true; error: string }
      >,
    check: () =>
      invokeWhitelisted(IPC_CHANNELS.updateCheck) as Promise<
        | { ok: true; native: true; state: UpdaterState }
        | { ok: false; native: true; error: string }
      >,
    download: () =>
      invokeWhitelisted(IPC_CHANNELS.updateDownload) as Promise<
        | { ok: true; native: true; state: UpdaterState }
        | { ok: false; native: true; error: string }
      >,
    install: () =>
      invokeWhitelisted(IPC_CHANNELS.updateInstall) as Promise<
        | { ok: true; native: true; state: UpdaterState }
        | { ok: false; native: true; error: string }
      >,
    onStateChange: (callback: (state: UpdaterState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isUpdaterState(value)) {
          callback(value);
        }
      };

      ipcRenderer.on(IPC_CHANNELS.updateStateChanged, listener);

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.updateStateChanged, listener);
      };
    }
  },
  activity: {
    getSnapshot: () =>
      invokeWhitelisted(IPC_CHANNELS.activityGetSnapshot) as Promise<
        | {
            ok: true;
            native: true;
            snapshot: Readonly<{
              kind: "none" | "game" | "music";
              statusText: string | null;
              source: string | null;
              title: string | null;
              detail: string | null;
              supported: boolean;
            }>;
          }
        | { ok: false; native: true; error: string }
      >
  },
  settings: {
    get: () =>
      invokeWhitelisted(IPC_CHANNELS.settingsGet) as Promise<
        | { ok: true; native: true; settings: Record<string, unknown> }
        | { ok: false; native: true; error: string }
      >,
    set: (partial: Record<string, unknown>) =>
      invokeWhitelisted(IPC_CHANNELS.settingsSet, partial) as Promise<
        | { ok: true; native: true; settings: Record<string, unknown> }
        | { ok: false; native: true; error: string }
      >,
    reset: () =>
      invokeWhitelisted(IPC_CHANNELS.settingsReset) as Promise<
        | { ok: true; native: true; settings: Record<string, unknown> }
        | { ok: false; native: true; error: string }
      >,
  },
  cache: {
    getUsage: () =>
      invokeWhitelisted(IPC_CHANNELS.cacheGetUsage) as Promise<
        | {
            ok: true;
            native: true;
            usage: Readonly<{
              userDataBytes: number;
              cacheBytes: number;
              logsBytes: number;
              tempBytes: number;
            }>;
          }
        | { ok: false; native: true; error: string }
      >,
    clear: (scope: "all" | "media" = "all") =>
      invokeWhitelisted(IPC_CHANNELS.cacheClear, scope) as Promise<
        | {
            ok: true;
            native: true;
            usage: Readonly<{
              userDataBytes: number;
              cacheBytes: number;
              logsBytes: number;
              tempBytes: number;
            }>;
          }
        | { ok: false; native: true; error: string }
      >,
  },
  appPaths: {
    open: (target: "logs" | "downloads" | "userData") =>
      invokeWhitelisted(IPC_CHANNELS.appOpenPath, target) as Promise<
        | { ok: true; native: true; target: "logs" | "downloads" | "userData" }
        | { ok: false; native: true; error: string }
      >,
  },
});

contextBridge.exposeInMainWorld("picomDesktop", Object.freeze(bridge));
