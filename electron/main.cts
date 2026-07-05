import { app, BrowserWindow, Menu, ipcMain, shell, desktopCapturer, Notification } from "electron";
import path from "node:path";
import { ELECTRON_APP_CONFIG } from "./appConfig.cjs";
import { IPC_CHANNELS } from "./ipcChannels.cjs";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

type WindowAction = "minimize" | "maximize" | "close";
type SafeScreenCaptureSource = Readonly<{
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnailDataUrl: string | null;
  appIconDataUrl: string | null;
}>;
type SafeNotificationPayload = Readonly<{
  title: string;
  body?: string;
  silent?: boolean;
}>;

let mainWindow: BrowserWindow | null = null;

function isWindowAction(action: unknown): action is WindowAction {
  return action === "minimize" || action === "maximize" || action === "close";
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isTrustedAppUrl(url: string): boolean {
  if (app.isPackaged) {
    return url.startsWith("file://");
  }

  return url.startsWith(DEV_SERVER_URL);
}

function openExternalSafely(url: string): void {
  if (!isSafeExternalUrl(url)) {
    return;
  }

  shell.openExternal(url).catch(() => undefined);
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function parseNotificationPayload(value: unknown): SafeNotificationPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = sanitizeText(record.title, 120);
  if (!title) {
    return null;
  }

  return {
    title,
    body: sanitizeText(record.body, 240),
    silent: typeof record.silent === "boolean" ? record.silent : undefined
  };
}

function sendWindowMaximizeState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  window.webContents.send(IPC_CHANNELS.windowMaximizeStateChanged, window.isMaximized() || window.isFullScreen());
}

function configureWebContents(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrustedAppUrl(url)) {
      return;
    }

    event.preventDefault();
    openExternalSafely(url);
  });
}

function registerWindowStateForwarding(window: BrowserWindow): void {
  const forwardState = () => sendWindowMaximizeState(window);

  window.on("maximize", forwardState);
  window.on("unmaximize", forwardState);
  window.on("enter-full-screen", forwardState);
  window.on("leave-full-screen", forwardState);
  window.webContents.on("did-finish-load", forwardState);
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.windowControl, (event, action: unknown) => {
    if (!isWindowAction(action)) {
      return { ok: false, native: true, error: "INVALID_WINDOW_ACTION" } as const;
    }

    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return { ok: false, native: true, error: "WINDOW_NOT_FOUND" } as const;
    }

    if (action === "minimize") {
      window.minimize();
    }

    if (action === "maximize") {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }

    if (action === "close") {
      window.close();
    }

    return { ok: true, native: true, action } as const;
  });

  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    return {
      ok: Boolean(window),
      native: true,
      maximized: window ? window.isMaximized() || window.isFullScreen() : false
    } as const;
  });

  ipcMain.handle(IPC_CHANNELS.screenCaptureGetSources, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });

      const safeSources: SafeScreenCaptureSource[] = sources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.id.startsWith("screen:") ? "screen" : "window",
        thumbnailDataUrl: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
        appIconDataUrl: source.appIcon?.isEmpty() ? null : source.appIcon?.toDataURL() ?? null
      }));

      return { ok: true, native: true, sources: safeSources } as const;
    } catch {
      return { ok: false, native: true, error: "SCREEN_CAPTURE_SOURCES_UNAVAILABLE" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.notificationShow, (_event, payload: unknown) => {
    const safePayload = parseNotificationPayload(payload);
    if (!safePayload) {
      return { ok: false, native: true, error: "INVALID_NOTIFICATION_PAYLOAD" } as const;
    }

    if (!Notification.isSupported()) {
      return { ok: false, native: true, error: "NOTIFICATIONS_UNSUPPORTED" } as const;
    }

    try {
      const notification = new Notification({
        title: safePayload.title,
        body: safePayload.body,
        silent: safePayload.silent
      });
      notification.show();
      return { ok: true, native: true } as const;
    } catch {
      return { ok: false, native: true, error: "NOTIFICATION_SHOW_FAILED" } as const;
    }
  });
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: ELECTRON_APP_CONFIG.window.defaultWidth,
    height: ELECTRON_APP_CONFIG.window.defaultHeight,
    minWidth: ELECTRON_APP_CONFIG.window.minWidth,
    minHeight: ELECTRON_APP_CONFIG.window.minHeight,
    show: false,
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
    title: ELECTRON_APP_CONFIG.name,
    backgroundColor: ELECTRON_APP_CONFIG.window.backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);

  configureWebContents(mainWindow);
  registerWindowStateForwarding(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (mainWindow) {
      sendWindowMaximizeState(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    await mainWindow.loadURL(DEV_SERVER_URL);
  }
}

app.setAppUserModelId(ELECTRON_APP_CONFIG.appId);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  void createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
