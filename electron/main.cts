import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  desktopCapturer,
  Notification,
  Tray,
  nativeImage,
  dialog,
  clipboard,
  type OpenDialogOptions,
  type SaveDialogOptions
} from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
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
type TrayStatus = "online" | "idle" | "dnd" | "invisible";
type TrayAction = "open" | "settings" | "mute" | "quit" | "online" | "idle" | "dnd" | "invisible";
type SafePickedImageFile = Readonly<{
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}>;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayStatus: TrayStatus = "online";
let trayMuted = false;

function isWindowAction(action: unknown): action is WindowAction {
  return action === "minimize" || action === "maximize" || action === "close";
}

function isTrayStatus(status: unknown): status is TrayStatus {
  return status === "online" || status === "idle" || status === "dnd" || status === "invisible";
}

function isSafeExternalUrl(url: string): boolean {
  return normalizeExternalUrl(url) !== null;
}

function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const url = value.trim();
  if (!url || url.length > 2048) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function isTrustedAppUrl(url: string): boolean {
  if (app.isPackaged) {
    return url.startsWith("file://");
  }

  return url.startsWith(DEV_SERVER_URL);
}

function openExternalSafely(url: string): void {
  const safeUrl = normalizeExternalUrl(url);
  if (!safeUrl) {
    return;
  }

  shell.openExternal(safeUrl).catch(() => undefined);
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function sendTrayAction(action: TrayAction): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.trayAction, {
    action,
    status: trayStatus,
    muted: trayMuted
  });
}

function createTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: "Open Picom",
      click: () => {
        focusMainWindow();
        sendTrayAction("open");
      }
    },
    { type: "separator" },
    {
      label: "Set Status",
      submenu: [
        { label: "Online", type: "radio", checked: trayStatus === "online", click: () => updateTrayStatus("online") },
        { label: "Idle", type: "radio", checked: trayStatus === "idle", click: () => updateTrayStatus("idle") },
        { label: "Do Not Disturb", type: "radio", checked: trayStatus === "dnd", click: () => updateTrayStatus("dnd") },
        { label: "Invisible", type: "radio", checked: trayStatus === "invisible", click: () => updateTrayStatus("invisible") }
      ]
    },
    {
      label: "Mute Notifications",
      type: "checkbox",
      checked: trayMuted,
      click: () => updateTrayMuted(!trayMuted)
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => {
        focusMainWindow();
        sendTrayAction("settings");
      }
    },
    {
      label: "Quit",
      click: () => {
        sendTrayAction("quit");
        app.quit();
      }
    }
  ]);
}

function refreshTray(): void {
  if (!tray) {
    return;
  }

  tray.setToolTip(`Picom - ${trayStatus}${trayMuted ? " - muted" : ""}`);
  tray.setContextMenu(createTrayMenu());
}

function updateTrayStatus(status: TrayStatus): void {
  trayStatus = status;
  refreshTray();
  sendTrayAction(status);
}

function updateTrayMuted(muted: boolean): void {
  trayMuted = muted;
  refreshTray();
  sendTrayAction("mute");
}

function createTray(): void {
  if (tray) {
    return;
  }

  const iconPath = path.join(__dirname, "..", "assets", "brand", "app-icon.png");
  const icon = nativeImage.createFromPath(iconPath);

  try {
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.on("click", () => {
      focusMainWindow();
      sendTrayAction("open");
    });
    refreshTray();
  } catch {
    tray = null;
  }
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

const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);
const maxNativePickedImageBytes = 10 * 1024 * 1024;
const maxClipboardTextLength = 1024 * 1024;

function sanitizeDefaultFileName(value: unknown): string {
  const fallback = "picom-export.txt";
  const raw = sanitizeText(value, 120) ?? fallback;
  const safe = raw.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return safe || fallback;
}

function parseSaveTextPayload(value: unknown): { defaultPath: string; content: string } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.content !== "string") {
    return null;
  }

  return {
    defaultPath: sanitizeDefaultFileName(record.defaultPath),
    content: record.content.slice(0, 2 * 1024 * 1024)
  };
}

function parseClipboardWritePayload(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.slice(0, maxClipboardTextLength);
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

  ipcMain.handle(IPC_CHANNELS.traySetStatus, (_event, status: unknown) => {
    if (!isTrayStatus(status)) {
      return { ok: false, native: true, error: "INVALID_TRAY_STATUS" } as const;
    }

    updateTrayStatus(status);
    return { ok: true, native: true, status } as const;
  });

  ipcMain.handle(IPC_CHANNELS.traySetMuted, (_event, muted: unknown) => {
    if (typeof muted !== "boolean") {
      return { ok: false, native: true, error: "INVALID_TRAY_MUTED_STATE" } as const;
    }

    updateTrayMuted(muted);
    return { ok: true, native: true, muted } as const;
  });

  ipcMain.handle(IPC_CHANNELS.trayShowWindow, () => {
    focusMainWindow();
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.trayQuit, () => {
    app.quit();
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.filePickImages, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
    const options: OpenDialogOptions = {
      title: "Choose images",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

    if (result.canceled) {
      return { ok: true, native: true, canceled: true, files: [] } as const;
    }

    const files: SafePickedImageFile[] = [];

    for (const filePath of result.filePaths.slice(0, 4)) {
      const extension = path.extname(filePath).toLowerCase();
      const mimeType = imageMimeByExtension.get(extension);
      if (!mimeType) continue;

      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat || !stat.isFile() || stat.size > maxNativePickedImageBytes) continue;

      const data = await fs.readFile(filePath).catch(() => null);
      if (!data) continue;

      files.push({
        name: path.basename(filePath),
        type: mimeType,
        size: stat.size,
        dataUrl: `data:${mimeType};base64,${data.toString("base64")}`
      });
    }

    return { ok: true, native: true, canceled: false, files } as const;
  });

  ipcMain.handle(IPC_CHANNELS.fileSaveText, async (event, payload: unknown) => {
    const safePayload = parseSaveTextPayload(payload);
    if (!safePayload) {
      return { ok: false, native: true, error: "INVALID_SAVE_TEXT_PAYLOAD" } as const;
    }

    const window = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
    const options: SaveDialogOptions = {
      title: "Save Picom file",
      defaultPath: safePayload.defaultPath,
      filters: [{ name: "Text", extensions: ["txt", "json", "log"] }]
    };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { ok: true, native: true, canceled: true } as const;
    }

    try {
      await fs.writeFile(result.filePath, safePayload.content, "utf8");
      return { ok: true, native: true, canceled: false } as const;
    } catch {
      return { ok: false, native: true, error: "SAVE_TEXT_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.clipboardReadText, () => {
    try {
      return {
        ok: true,
        native: true,
        text: clipboard.readText().slice(0, maxClipboardTextLength)
      } as const;
    } catch {
      return { ok: false, native: true, error: "CLIPBOARD_READ_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.clipboardWriteText, (_event, payload: unknown) => {
    const safeText = parseClipboardWritePayload(payload);
    if (safeText === null) {
      return { ok: false, native: true, error: "INVALID_CLIPBOARD_TEXT" } as const;
    }

    try {
      clipboard.writeText(safeText);
      return { ok: true, native: true } as const;
    } catch {
      return { ok: false, native: true, error: "CLIPBOARD_WRITE_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.externalOpenUrl, async (_event, payload: unknown) => {
    const safeUrl = normalizeExternalUrl(payload);
    if (!safeUrl) {
      return { ok: false, native: true, error: "UNSAFE_EXTERNAL_URL" } as const;
    }

    try {
      await shell.openExternal(safeUrl);
      return { ok: true, native: true, url: safeUrl } as const;
    } catch {
      return { ok: false, native: true, error: "EXTERNAL_URL_OPEN_FAILED" } as const;
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
  createTray();

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
