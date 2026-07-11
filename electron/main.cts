import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  desktopCapturer,
  systemPreferences,
  Notification,
  Tray,
  nativeImage,
  dialog,
  clipboard,
  screen,
  powerMonitor,
  type OpenDialogOptions,
  type SaveDialogOptions
} from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import { ELECTRON_APP_CONFIG } from "./appConfig.cjs";
import { IPC_CHANNELS } from "./ipcChannels.cjs";
import {
  MAX_CLIPBOARD_TEXT_LENGTH,
  isSafeDeepLink,
  isTrayStatus,
  isWindowAction,
  normalizeExternalUrl,
  parseClipboardWritePayload,
  parseNotificationPayload,
  parseSaveTextPayload,
  parseScreenCaptureCancelPayload,
  parseScreenCaptureListPayload,
  parseScreenCaptureSelectionPayload,
  isSafeScreenCaptureSourceId,
  type TrayStatus,
} from "./ipcPayloadValidation.cjs";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

type SafeScreenCaptureSource = Readonly<{
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnailDataUrl: string | null;
  appIconDataUrl: string | null;
}>;
type ScreenCaptureSession = Readonly<{
  requestId: string;
  expiresAt: number;
  sources: ReadonlyMap<string, SafeScreenCaptureSource>;
}>;
type TrayAction = "open" | "settings" | "mute" | "quit" | "online" | "idle" | "dnd" | "invisible";
type SafePickedImageFile = Readonly<{
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}>;
type PersistedWindowState = Readonly<{
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
}>;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayStatus: TrayStatus = "online";
let trayMuted = false;
let closeToTrayEnabled = false;
let isQuitting = false;
const pendingDeepLinks: string[] = [];
let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null;
const screenCaptureSessions = new WeakMap<object, ScreenCaptureSession>();
const SCREEN_CAPTURE_SESSION_TTL_MS = 60_000;
const MAX_SCREEN_CAPTURE_SOURCES = 50;
const MAX_SCREEN_CAPTURE_DATA_URL_LENGTH = 512 * 1024;

function sanitizeScreenCaptureName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Untitled source";
}

function boundedCaptureDataUrl(value: string | null): string | null {
  return value && value.startsWith("data:image/png;base64,") && value.length <= MAX_SCREEN_CAPTURE_DATA_URL_LENGTH ? value : null;
}
function isSafeExternalUrl(url: string): boolean {
  return normalizeExternalUrl(url) !== null;
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

function isTrustedIpcEvent(event: Electron.IpcMainInvokeEvent): boolean {
  return isTrustedAppUrl(event.sender.getURL());
}


function extractDeepLinkFromArgs(args: string[]): string | null {
  return args.find((arg) => isSafeDeepLink(arg)) ?? null;
}

function sendDeepLinkToRenderer(deepLink: string): void {
  if (!isSafeDeepLink(deepLink)) {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoadingMainFrame()) {
    pendingDeepLinks.push(deepLink);
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.deepLinkOpen, deepLink);
}

function handleNativeDeepLink(deepLink: unknown): void {
  if (!isSafeDeepLink(deepLink)) {
    return;
  }

  if (!app.isReady()) {
    pendingDeepLinks.push(deepLink);
    return;
  }

  focusMainWindow();
  sendDeepLinkToRenderer(deepLink);
}

function flushPendingDeepLinks(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  while (pendingDeepLinks.length > 0) {
    const deepLink = pendingDeepLinks.shift();
    if (deepLink) {
      mainWindow.webContents.send(IPC_CHANNELS.deepLinkOpen, deepLink);
    }
  }
}

function registerProtocolHandler(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("picom", process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient("picom");
}

function sendPowerResumeToRenderer(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.powerResume, {
    timestamp: new Date().toISOString()
  });
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
        isQuitting = true;
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

const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);
const maxNativePickedImageBytes = 10 * 1024 * 1024;

function getWindowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function normalizeWindowState(value: unknown): PersistedWindowState | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const width = Number(record.width);
  const height = Number(record.height);
  const x = Number(record.x);
  const y = Number(record.y);
  const isMaximized = Boolean(record.isMaximized);

  if (![width, height, x, y].every(Number.isFinite)) {
    return null;
  }

  const safeState: PersistedWindowState = {
    width: Math.max(ELECTRON_APP_CONFIG.window.minWidth, Math.round(width)),
    height: Math.max(ELECTRON_APP_CONFIG.window.minHeight, Math.round(height)),
    x: Math.round(x),
    y: Math.round(y),
    isMaximized
  };

  return isWindowStateVisible(safeState) ? safeState : null;
}

function isWindowStateVisible(state: PersistedWindowState): boolean {
  const minimumVisibleSize = 120;
  const right = state.x + state.width;
  const bottom = state.y + state.height;

  return screen.getAllDisplays().some((display) => {
    const bounds = display.workArea;
    const visibleWidth = Math.min(right, bounds.x + bounds.width) - Math.max(state.x, bounds.x);
    const visibleHeight = Math.min(bottom, bounds.y + bounds.height) - Math.max(state.y, bounds.y);
    return visibleWidth >= minimumVisibleSize && visibleHeight >= minimumVisibleSize;
  });
}

async function loadWindowState(): Promise<PersistedWindowState | null> {
  try {
    const raw = await fs.readFile(getWindowStatePath(), "utf8");
    return normalizeWindowState(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function persistWindowState(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed() || window.isFullScreen()) {
    return;
  }

  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
  const state: PersistedWindowState = {
    width: Math.max(ELECTRON_APP_CONFIG.window.minWidth, bounds.width),
    height: Math.max(ELECTRON_APP_CONFIG.window.minHeight, bounds.height),
    x: bounds.x,
    y: bounds.y,
    isMaximized: window.isMaximized()
  };

  try {
    await fs.writeFile(getWindowStatePath(), JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Window state persistence is best-effort and must never block startup/shutdown.
  }
}

function scheduleWindowStatePersistence(window: BrowserWindow): void {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }

  windowStateSaveTimer = setTimeout(() => {
    void persistWindowState(window);
  }, 350);
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

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function registerWindowStateForwarding(window: BrowserWindow): void {
  const forwardState = () => sendWindowMaximizeState(window);
  const persistState = () => scheduleWindowStatePersistence(window);

  window.on("maximize", forwardState);
  window.on("unmaximize", forwardState);
  window.on("enter-full-screen", forwardState);
  window.on("leave-full-screen", forwardState);
  window.on("resize", persistState);
  window.on("move", persistState);
  window.on("maximize", persistState);
  window.on("unmaximize", persistState);
  window.on("close", () => {
    if (windowStateSaveTimer) {
      clearTimeout(windowStateSaveTimer);
      windowStateSaveTimer = null;
    }
    void persistWindowState(window);
  });
  window.webContents.on("did-finish-load", forwardState);
  window.webContents.on("did-finish-load", flushPendingDeepLinks);
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.windowControl, (event, action: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    if (!isWindowAction(action)) {
      return { ok: false, native: true, error: "INVALID_WINDOW_ACTION" } as const;
    }

    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window || window.isDestroyed()) {
      return { ok: false, native: true, error: "WINDOW_NOT_FOUND" } as const;
    }

    try {
      if (action === "minimize") {
        window.minimize();
      }

      if (action === "maximize") {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
        sendWindowMaximizeState(window);
      }

      const maximized = !window.isDestroyed() && (window.isMaximized() || window.isFullScreen());

      if (action === "close") {
        window.close();
      }

      return { ok: true, native: true, action, maximized } as const;
    } catch {
      return { ok: false, native: true, error: "WINDOW_ACTION_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window || window.isDestroyed()) {
      return { ok: false, native: true, maximized: false, error: "WINDOW_NOT_FOUND" } as const;
    }

    return { ok: true, native: true, maximized: window.isMaximized() || window.isFullScreen() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.screenCaptureGetSources, async (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) {
      return { ok: false, native: true, error: "UNTRUSTED_SCREEN_CAPTURE_SENDER", platform: process.platform } as const;
    }

    const safePayload = parseScreenCaptureListPayload(payload);
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (!safePayload || !sourceWindow || sourceWindow.isDestroyed() || !sourceWindow.isFocused()) {
      return { ok: false, native: true, error: "SCREEN_CAPTURE_USER_ACTION_REQUIRED", platform: process.platform } as const;
    }

    try {
      if (process.platform === "darwin") {
        const permission = systemPreferences.getMediaAccessStatus("screen");
        if (permission === "denied" || permission === "restricted") {
          return { ok: false, native: true, error: "SCREEN_CAPTURE_PERMISSION_DENIED", platform: process.platform } as const;
        }
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });

      const safeSources: SafeScreenCaptureSource[] = sources
        .filter((source) => isSafeScreenCaptureSourceId(source.id))
        .slice(0, MAX_SCREEN_CAPTURE_SOURCES)
        .map((source) => ({
          id: source.id,
          name: sanitizeScreenCaptureName(source.name),
          type: source.id.startsWith("screen:") ? "screen" : "window",
          thumbnailDataUrl: boundedCaptureDataUrl(source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL()),
          appIconDataUrl: boundedCaptureDataUrl(source.appIcon?.isEmpty() ? null : source.appIcon?.toDataURL() ?? null)
        }));

      if (safeSources.length === 0) {
        return { ok: false, native: true, error: "SCREEN_CAPTURE_NO_SOURCES", platform: process.platform } as const;
      }

      screenCaptureSessions.set(event.sender, {
        requestId: safePayload.requestId,
        expiresAt: Date.now() + SCREEN_CAPTURE_SESSION_TTL_MS,
        sources: new Map(safeSources.map((source) => [source.id, source])),
      });
      return { ok: true, native: true, requestId: safePayload.requestId, sources: safeSources } as const;
    } catch {
      return { ok: false, native: true, error: "SCREEN_CAPTURE_SOURCES_UNAVAILABLE", platform: process.platform } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.screenCaptureSelectSource, (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_SCREEN_CAPTURE_SENDER" } as const;
    const safePayload = parseScreenCaptureSelectionPayload(payload);
    if (!safePayload) return { ok: false, native: true, error: "INVALID_SCREEN_CAPTURE_SELECTION" } as const;

    const session = screenCaptureSessions.get(event.sender);
    if (!session || session.requestId !== safePayload.requestId || session.expiresAt < Date.now()) {
      screenCaptureSessions.delete(event.sender);
      return { ok: false, native: true, error: "SCREEN_CAPTURE_SELECTION_EXPIRED" } as const;
    }
    const source = session.sources.get(safePayload.sourceId);
    screenCaptureSessions.delete(event.sender);
    if (!source) return { ok: false, native: true, error: "SCREEN_CAPTURE_SOURCE_NOT_ALLOWED" } as const;
    return { ok: true, native: true, source: { id: source.id, name: source.name, type: source.type } } as const;
  });

  ipcMain.handle(IPC_CHANNELS.screenCaptureCancelSelection, (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_SCREEN_CAPTURE_SENDER" } as const;
    const safePayload = parseScreenCaptureCancelPayload(payload);
    if (!safePayload) return { ok: false, native: true, error: "INVALID_SCREEN_CAPTURE_CANCEL" } as const;
    const session = screenCaptureSessions.get(event.sender);
    if (session?.requestId === safePayload.requestId) screenCaptureSessions.delete(event.sender);
    return { ok: true, native: true, canceled: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.notificationShow, (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) {
      return { ok: false, native: true, error: "UNTRUSTED_NOTIFICATION_SENDER" } as const;
    }

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
      if (safePayload.deepLink) notification.on("click",()=>handleNativeDeepLink(safePayload.deepLink));
      notification.show();
      return { ok: true, native: true } as const;
    } catch {
      return { ok: false, native: true, error: "NOTIFICATION_SHOW_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.traySetStatus, (event, status: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    if (!isTrayStatus(status)) {
      return { ok: false, native: true, error: "INVALID_TRAY_STATUS" } as const;
    }

    updateTrayStatus(status);
    return { ok: true, native: true, status } as const;
  });

  ipcMain.handle(IPC_CHANNELS.traySetMuted, (event, muted: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    if (typeof muted !== "boolean") {
      return { ok: false, native: true, error: "INVALID_TRAY_MUTED_STATE" } as const;
    }

    updateTrayMuted(muted);
    return { ok: true, native: true, muted } as const;
  });

  ipcMain.handle(IPC_CHANNELS.traySetCloseToTray, (event, enabled: unknown) => {
    if (!isTrustedIpcEvent(event) || typeof enabled !== "boolean") {
      return { ok: false, native: true, error: "INVALID_CLOSE_TO_TRAY_STATE" } as const;
    }

    closeToTrayEnabled = enabled;
    return { ok: true, native: true, enabled, supported: Boolean(tray) } as const;
  });

  ipcMain.handle(IPC_CHANNELS.trayShowWindow, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    focusMainWindow();
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.trayQuit, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    isQuitting = true;
    app.quit();
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.startupGetState, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_STARTUP_SENDER" } as const;
    const supported = app.isPackaged && (process.platform === "win32" || process.platform === "darwin");
    if (!supported) return { ok: true, native: true, supported: false, enabled: false } as const;
    try {
      return { ok: true, native: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin } as const;
    } catch {
      return { ok: false, native: true, error: "STARTUP_STATE_UNAVAILABLE" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.startupSetEnabled, (event, enabled: unknown) => {
    if (!isTrustedIpcEvent(event) || typeof enabled !== "boolean") return { ok: false, native: true, error: "INVALID_STARTUP_STATE" } as const;
    if (!app.isPackaged) return { ok: false, native: true, error: "STARTUP_REQUIRES_PACKAGED_APP" } as const;
    if (process.platform !== "win32" && process.platform !== "darwin") return { ok: false, native: true, error: "STARTUP_UNSUPPORTED" } as const;
    try {
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
      return { ok: true, native: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin } as const;
    } catch {
      return { ok: false, native: true, error: "STARTUP_UPDATE_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.filePickImages, async (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
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
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
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

  ipcMain.handle(IPC_CHANNELS.clipboardReadText, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    try {
      return {
        ok: true,
        native: true,
        text: clipboard.readText().slice(0, MAX_CLIPBOARD_TEXT_LENGTH)
      } as const;
    } catch {
      return { ok: false, native: true, error: "CLIPBOARD_READ_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.clipboardWriteText, (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
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

  ipcMain.handle(IPC_CHANNELS.externalOpenUrl, async (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
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
  const savedWindowState = await loadWindowState();

  mainWindow = new BrowserWindow({
    width: savedWindowState?.width ?? ELECTRON_APP_CONFIG.window.defaultWidth,
    height: savedWindowState?.height ?? ELECTRON_APP_CONFIG.window.defaultHeight,
    x: savedWindowState?.x,
    y: savedWindowState?.y,
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

  if (savedWindowState?.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (mainWindow) {
      sendWindowMaximizeState(mainWindow);
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && closeToTrayEnabled && tray) {
      event.preventDefault();
      mainWindow?.hide();
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

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = extractDeepLinkFromArgs(argv);
    if (deepLink) {
      handleNativeDeepLink(deepLink);
    } else {
      focusMainWindow();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerProtocolHandler();
    registerIpcHandlers();
    powerMonitor.on("resume", sendPowerResumeToRenderer);

    const initialDeepLink = extractDeepLinkFromArgs(process.argv);
    if (initialDeepLink) {
      pendingDeepLinks.push(initialDeepLink);
    }

    void createMainWindow();
    createTray();

    app.on("activate", focusMainWindow);
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleNativeDeepLink(url);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
