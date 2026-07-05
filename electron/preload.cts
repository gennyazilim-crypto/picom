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

type PicomRuntimeInfo = Readonly<{
  runtime: "electron";
  platform: string;
  versions: Readonly<{
    electron?: string;
    chrome?: string;
    node?: string;
  }>;
}>;

function isWindowAction(action: unknown): action is WindowAction {
  return action === "minimize" || action === "maximize" || action === "close";
}

function invokeWhitelisted(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!isIpcChannel(channel)) {
    return Promise.resolve({ ok: false, native: true, error: "IPC_CHANNEL_NOT_ALLOWED" });
  }

  return ipcRenderer.invoke(channel, ...args);
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
  getRuntimeInfo: (): PicomRuntimeInfo => runtimeInfo,
  windowControl: (action: WindowAction) => {
    if (!isWindowAction(action)) {
      return Promise.resolve({ ok: false, native: true, error: "INVALID_WINDOW_ACTION" } as const);
    }

    return invokeWhitelisted(IPC_CHANNELS.windowControl, action) as Promise<
      | { ok: true; native: true; action: WindowAction }
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
        | { ok: false; native: true; error: string }
      >
  },
  showNotification: (payload: NativeNotificationPayload) =>
    invokeWhitelisted(IPC_CHANNELS.notificationShow, payload) as Promise<
      | { ok: true; native: true }
      | { ok: false; native: true; error: string }
    >
});

contextBridge.exposeInMainWorld("picomDesktop", bridge);
