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
  type DesktopCapturerSource,
  type Display,
  type OpenDialogOptions,
  type SaveDialogOptions
} from "electron";
import { CompanionWindowManager } from "./companionWindowManager.cjs";
import path from "node:path";
import { promises as fs } from "node:fs";
import { ELECTRON_APP_CONFIG } from "./appConfig.cjs";
import { IPC_CHANNELS } from "./ipcChannels.cjs";
import { setMainLocale, translateMain } from "./mainLocale.cjs";
import {
  checkForUpdates as updaterCheckForUpdates,
  downloadUpdate as updaterDownloadUpdate,
  getUpdaterState,
  initUpdater,
  quitAndInstall as updaterQuitAndInstall,
  type UpdaterState,
} from "./updater.cjs";
import { getActivitySnapshot } from "./activityPresence.cjs";
import {
  MAX_CLIPBOARD_TEXT_LENGTH,
  isSafeDeepLink,
  isTrayStatus,
  isWindowAction,
  normalizeExternalUrl,
  parseClipboardWritePayload,
  parseIncomingCallToastAction,
  parseIncomingCallToastPayload,
  parseNotificationPayload,
  parseSaveTextPayload,
  parseScreenCaptureCancelPayload,
  parseScreenCaptureListPayload,
  parseScreenCaptureSelectionPayload,
  isSafeScreenCaptureSourceId,
  type TrayStatus,
} from "./ipcPayloadValidation.cjs";
import {
  dismissIncomingCallToast,
  handleIncomingCallToastResponse,
  isIncomingCallToastSender,
  resolveIncomingCallPreloadPath,
  setIncomingCallToastActionHandler,
  showIncomingCallToast,
} from "./incomingCallToast.cjs";
import {
  handleDesktopNotificationToastAction,
  initializeDesktopNotificationToastHost,
  isDesktopNotificationToastSender,
  resolveDesktopNotificationToastPreloadPath,
  setDesktopNotificationToastActionHandler,
  showDesktopNotificationToast,
  type DesktopNotificationToastPayload,
} from "./desktopNotificationToastHost.cjs";
import { prepareNotificationAvatar } from "./notificationAvatarCache.cjs";
import {
  measureCacheUsage,
  readDeviceLocalSettings,
  resetDeviceLocalSettings,
  resolveSafeOpenPath,
  writeDeviceLocalSettings,
  type SafeOpenTarget,
} from "./deviceLocalSettingsStore.cjs";
import { isAllowedInterfaceScale } from "./uiScalePolicy.cjs";
import { shouldInterceptMainWindowClose, shouldStartHiddenInTray as shouldStartHiddenInTrayPolicy } from "./desktopBehaviorPolicy.cjs";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
const PICOM_LOGIN_STARTUP_FLAG = "--picom-login-startup";
const APP_ICON_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "brand",
  process.platform === "win32" ? "app-icon.ico" : "app-icon.png"
);
let incomingCallPresentationGeneration = 0;
let lastTestNotificationAt = 0;
const TEST_NOTIFICATION_MIN_INTERVAL_MS = 1_000;

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
let companionWindowManager: CompanionWindowManager | null = null;
let tray: Tray | null = null;
let trayStatus: TrayStatus = "online";
let trayMuted = false;
let closeToTrayEnabled = true;
let isQuitting = false;
const pendingDeepLinks: string[] = [];
let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null;
const screenCaptureSessions = new WeakMap<object, ScreenCaptureSession>();
const SCREEN_CAPTURE_SESSION_TTL_MS = 60_000;
const MAX_SCREEN_CAPTURE_SOURCES = 80;
const MAX_SCREEN_CAPTURE_DATA_URL_LENGTH = 512 * 1024;

function sanitizeScreenCaptureName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Untitled source";
}

function boundedCaptureDataUrl(value: string | null): string | null {
  return value && value.startsWith("data:image/png;base64,") && value.length <= MAX_SCREEN_CAPTURE_DATA_URL_LENGTH ? value : null;
}

function isGenericEntireScreenName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "entire screen"
    || normalized === "entire screen "
    || normalized === "screen"
    || normalized === "tüm ekran"
    || normalized === "tum ekran"
    || normalized.startsWith("entire screen")
    || normalized.startsWith("tüm ekran")
    || normalized.startsWith("tum ekran");
}

function labelScreenCaptureSource(
  source: DesktopCapturerSource,
  displays: Display[],
  primaryDisplayId: number,
): string {
  const safeName = sanitizeScreenCaptureName(source.name);
  if (!source.id.startsWith("screen:")) return safeName;

  const displayId = typeof source.display_id === "string" ? source.display_id.trim() : "";
  const matched = displayId
    ? displays.find((display) => String(display.id) === displayId)
    : undefined;
  const ordered = [...displays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  const index = matched ? ordered.findIndex((display) => display.id === matched.id) : -1;
  if (matched && index >= 0) {
    const primary = matched.id === primaryDisplayId ? " · Primary" : "";
    return `Display ${index + 1} (${matched.size.width}×${matched.size.height})${primary}`;
  }

  if (displays.length > 1 && isGenericEntireScreenName(safeName)) {
    return `All displays (${displays.length})`;
  }

  return safeName;
}

async function listDesktopCapturerSources(): Promise<DesktopCapturerSource[]> {
  const readSources = async (
    types: Array<"screen" | "window">,
    options: Readonly<{ thumbnailSize: { width: number; height: number }; fetchWindowIcons: boolean }>,
  ): Promise<DesktopCapturerSource[]> => {
    try {
      return await desktopCapturer.getSources({
        types,
        thumbnailSize: options.thumbnailSize,
        fetchWindowIcons: options.fetchWindowIcons,
      });
    } catch {
      return [];
    }
  };

  const previewThumb = { width: 320, height: 180 };
  const listOnlyThumb = { width: 0, height: 0 };

  // Prefer separate queries so screens are not starved by a huge window list.
  let screenSources = await readSources(["screen"], { thumbnailSize: previewThumb, fetchWindowIcons: false });
  // Icons + large thumbs can fail on hybrid-GPU Windows and return zero windows — try light path first.
  let windowSources = await readSources(["window"], { thumbnailSize: previewThumb, fetchWindowIcons: false });

  if (windowSources.length === 0) {
    windowSources = await readSources(["window"], { thumbnailSize: listOnlyThumb, fetchWindowIcons: false });
  }
  if (windowSources.length === 0) {
    windowSources = await readSources(["window"], { thumbnailSize: previewThumb, fetchWindowIcons: true });
  }

  // Last resort: combined enumeration (classic Electron path).
  if (screenSources.length === 0 || windowSources.length === 0) {
    const combined = await readSources(["screen", "window"], { thumbnailSize: listOnlyThumb, fetchWindowIcons: false });
    if (screenSources.length === 0) {
      screenSources = combined.filter((source) => source.id.startsWith("screen:"));
    }
    if (windowSources.length === 0) {
      windowSources = combined.filter((source) => source.id.startsWith("window:"));
    }
  }

  // Re-fetch window thumbs when the list-only path succeeded without previews.
  if (windowSources.length > 0 && windowSources.every((source) => source.thumbnail.isEmpty())) {
    const withThumbs = await readSources(["window"], { thumbnailSize: previewThumb, fetchWindowIcons: false });
    if (withThumbs.length > 0) windowSources = withThumbs;
  }

  const seen = new Set<string>();
  const merged: DesktopCapturerSource[] = [];
  for (const source of [...screenSources, ...windowSources]) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    merged.push(source);
  }
  return merged;
}

function canEnumerateScreenCapture(
  event: Electron.IpcMainInvokeEvent,
  sourceWindow: BrowserWindow | null,
): boolean {
  if (!sourceWindow || sourceWindow.isDestroyed()) return false;
  if (sourceWindow.webContents.id !== event.sender.id) return false;
  if (sourceWindow.isMinimized()) return false;
  if (!sourceWindow.isVisible()) return false;
  // Focus can drop for a tick when the React modal mounts; still allow a visible Picom window.
  if (sourceWindow.isFocused()) return true;
  try {
    sourceWindow.focus();
  } catch {
    // ignore
  }
  return sourceWindow.isVisible();
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

/** Desktop behavior is owned by the primary window, never a companion/toast window. */
function isTrustedMainWindowIpcEvent(event: Electron.IpcMainInvokeEvent): boolean {
  return isTrustedIpcEvent(event) && Boolean(mainWindow && !mainWindow.isDestroyed() && BrowserWindow.fromWebContents(event.sender) === mainWindow);
}


function extractDeepLinkFromArgs(args: string[]): string | null {
  return args.find((arg) => isSafeDeepLink(arg)) ?? null;
}

function isAuthOpenDeepLink(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "picom:" && parsed.hostname === "auth" && parsed.pathname === "/open" && !parsed.search && !parsed.hash && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function sendDeepLinkToRenderer(deepLink: string): void {
  if (!isSafeDeepLink(deepLink) || isAuthOpenDeepLink(deepLink)) {
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
    if (deepLink && !isAuthOpenDeepLink(deepLink)) {
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
      label: translateMain("tray.openCompanion"),
      click: () => companionWindowManager?.enterMode(),
    },
    { type: "separator" },
    {
      label: translateMain("tray.openDesktop"),
      click: () => {
        focusMainWindow();
        sendTrayAction("open");
      }
    },
    { type: "separator" },
    {
      label: translateMain("tray.setStatus"),
      submenu: [
        { label: translateMain("tray.status.online"), type: "radio", checked: trayStatus === "online", click: () => updateTrayStatus("online") },
        { label: translateMain("tray.status.idle"), type: "radio", checked: trayStatus === "idle", click: () => updateTrayStatus("idle") },
        { label: translateMain("tray.status.dnd"), type: "radio", checked: trayStatus === "dnd", click: () => updateTrayStatus("dnd") },
        { label: translateMain("tray.status.invisible"), type: "radio", checked: trayStatus === "invisible", click: () => updateTrayStatus("invisible") }
      ]
    },
    {
      label: translateMain("tray.muteNotifications"),
      type: "checkbox",
      checked: trayMuted,
      click: () => updateTrayMuted(!trayMuted)
    },
    { type: "separator" },
    {
      label: translateMain("tray.settings"),
      click: () => {
        focusMainWindow();
        sendTrayAction("settings");
      }
    },
    {
      label: translateMain("tray.quit"),
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

  const statusLabel = translateMain(
    trayStatus === "idle" ? "tray.status.idle"
      : trayStatus === "dnd" ? "tray.status.dnd"
      : trayStatus === "invisible" ? "tray.status.invisible"
      : "tray.status.online",
  );
  tray.setToolTip(`Picom Desktop - ${statusLabel}${trayMuted ? ` - ${translateMain("tray.tooltipMuted")}` : ""}`);
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

function createTray(): boolean {
  if (tray) {
    return true;
  }

  const icon = nativeImage.createFromPath(APP_ICON_PATH);

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
  return tray !== null;
}

function supportsLoginItemSettings(): boolean {
  return app.isPackaged && (process.platform === "win32" || process.platform === "darwin");
}

function isLoginStartupLaunch(): boolean {
  if (process.argv.includes(PICOM_LOGIN_STARTUP_FLAG)) return true;
  if (!supportsLoginItemSettings()) return false;
  try {
    return (app.getLoginItemSettings() as Electron.LoginItemSettings & { wasOpenedAtLogin?: boolean }).wasOpenedAtLogin === true;
  } catch {
    return false;
  }
}

function syncLoginItemArgumentsForVisibility(startupVisibility: "normal" | "tray"): void {
  if (!supportsLoginItemSettings()) return;
  try {
    if (!app.getLoginItemSettings().openAtLogin) return;
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: startupVisibility === "tray" ? [PICOM_LOGIN_STARTUP_FLAG] : [],
    });
  } catch {
    // The runtime state handler reports this failure to the renderer on the next refresh.
  }
}

function shouldStartHiddenInTray(trayReady: boolean, hasExplicitLaunchIntent: boolean): boolean {
  return shouldStartHiddenInTrayPolicy({
    trayReady,
    loginStartup: isLoginStartupLaunch(),
    explicitLaunchIntent: hasExplicitLaunchIntent,
    settings: readDeviceLocalSettings(),
  });
}

const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".jfif", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".avif", "image/avif"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".svg", "image/svg+xml"],
  [".heic", "image/heic"],
  [".heif", "image/heif"]
]);
const maxNativePickedImageBytes = 12 * 1024 * 1024;

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

function broadcastUpdaterState(updaterState: UpdaterState): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(IPC_CHANNELS.updateStateChanged, updaterState);
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

  ipcMain.handle(IPC_CHANNELS.appearanceSetInterfaceScale, (event, scale: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    if (!isAllowedInterfaceScale(scale)) return { ok: false, native: true, error: "INVALID_UI_SCALE" } as const;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed() || window.webContents.id !== event.sender.id) {
      return { ok: false, native: true, error: "WINDOW_NOT_FOUND" } as const;
    }
    try {
      window.webContents.setZoomFactor(scale);
      return { ok: true, native: true, scale } as const;
    } catch {
      return { ok: false, native: true, error: "UI_SCALE_APPLY_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.screenCaptureGetSources, async (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) {
      return { ok: false, native: true, error: "UNTRUSTED_SCREEN_CAPTURE_SENDER", platform: process.platform } as const;
    }

    const safePayload = parseScreenCaptureListPayload(payload);
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (!safePayload || !canEnumerateScreenCapture(event, sourceWindow)) {
      return { ok: false, native: true, error: "SCREEN_CAPTURE_USER_ACTION_REQUIRED", platform: process.platform } as const;
    }

    try {
      if (process.platform === "darwin") {
        const permission = systemPreferences.getMediaAccessStatus("screen");
        if (permission === "denied" || permission === "restricted") {
          return { ok: false, native: true, error: "SCREEN_CAPTURE_PERMISSION_DENIED", platform: process.platform } as const;
        }
      }

      const sources = await listDesktopCapturerSources();
      const displays = screen.getAllDisplays();
      const primaryDisplayId = screen.getPrimaryDisplay().id;

      // Keep Picom / Chrome / other app windows visible in the picker. Content protection
      // on the live share path still prevents recursive entire-screen feedback loops.
      const filtered = sources.filter((source) => isSafeScreenCaptureSourceId(source.id));

      // Keep every screen even when the window list is long; fill remaining slots with windows.
      const screenFiltered = filtered.filter((source) => source.id.startsWith("screen:"));
      const windowFiltered = filtered.filter((source) => source.id.startsWith("window:"));
      const windowBudget = Math.max(0, MAX_SCREEN_CAPTURE_SOURCES - screenFiltered.length);
      const selectedSources = [...screenFiltered, ...windowFiltered.slice(0, windowBudget)];

      const safeSources: SafeScreenCaptureSource[] = selectedSources.map((source) => ({
        id: source.id,
        name: labelScreenCaptureSource(source, displays, primaryDisplayId),
        type: source.id.startsWith("screen:") ? "screen" : "window",
        thumbnailDataUrl: boundedCaptureDataUrl(source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL()),
        appIconDataUrl: boundedCaptureDataUrl(source.appIcon?.isEmpty() ? null : source.appIcon?.toDataURL() ?? null),
      }));

      if (safeSources.length === 0) {
        return { ok: false, native: true, error: "SCREEN_CAPTURE_NO_SOURCES", platform: process.platform } as const;
      }

      const screenSourceCount = safeSources.filter((source) => source.type === "screen").length;
      const windowSourceCount = safeSources.filter((source) => source.type === "window").length;
      const displayCount = displays.length;
      const incompleteDisplays = process.platform === "win32" && displayCount > screenSourceCount;

      screenCaptureSessions.set(event.sender, {
        requestId: safePayload.requestId,
        expiresAt: Date.now() + SCREEN_CAPTURE_SESSION_TTL_MS,
        sources: new Map(safeSources.map((source) => [source.id, source])),
      });
      return {
        ok: true,
        native: true,
        requestId: safePayload.requestId,
        sources: safeSources,
        diagnostics: {
          displayCount,
          screenSourceCount,
          windowSourceCount,
          incompleteDisplays,
        },
      } as const;
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

  ipcMain.handle(IPC_CHANNELS.screenCaptureSetContentProtection, (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_SCREEN_CAPTURE_SENDER" } as const;
    const enabled = typeof payload === "boolean" ? payload : Boolean((payload as { enabled?: unknown } | null)?.enabled);
    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
    for (const window of windows) {
      try {
        // Keeps Picom out of its own entire-screen capture (avoids recursive feedback for peers).
        window.setContentProtection(enabled);
      } catch {
        // Older Electron builds may reject; ignore and continue other windows.
      }
    }
    return { ok: true, native: true, enabled } as const;
  });

  ipcMain.handle(IPC_CHANNELS.notificationGetCapability, (event) => {
    if (!isTrustedMainWindowIpcEvent(event)) {
      return { ok: false, native: true, error: "UNTRUSTED_NOTIFICATION_SENDER" } as const;
    }
    return { ok: true, native: true, supported: Notification.isSupported() } as const;
  });

  /**
   * Deliberately payload-free: the renderer cannot turn onboarding's test action
   * into arbitrary OS-notification content or an arbitrary navigation intent.
   */
  ipcMain.handle(IPC_CHANNELS.notificationSendTest, (event) => {
    if (!isTrustedMainWindowIpcEvent(event)) {
      return { ok: false, native: true, error: "UNTRUSTED_NOTIFICATION_SENDER" } as const;
    }
    if (!Notification.isSupported()) {
      return { ok: false, native: true, error: "NOTIFICATIONS_UNSUPPORTED" } as const;
    }
    const now = Date.now();
    if (now - lastTestNotificationAt < TEST_NOTIFICATION_MIN_INTERVAL_MS) {
      return { ok: false, native: true, error: "TEST_NOTIFICATION_THROTTLED" } as const;
    }
    try {
      lastTestNotificationAt = now;
      new Notification({
        title: translateMain("notification.testTitle"),
        body: translateMain("notification.testBody"),
        silent: false,
      }).show();
      return { ok: true, native: true } as const;
    } catch {
      return { ok: false, native: true, error: "NOTIFICATION_SHOW_FAILED" } as const;
    }
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

  setDesktopNotificationToastActionHandler((action, notificationId) => {
    if (action !== "dismiss") focusMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IPC_CHANNELS.desktopNotificationToastEvent, { action, notificationId });
  });

  ipcMain.handle(IPC_CHANNELS.desktopNotificationToastShow, (event, payload: unknown) => {
    if (!isTrustedMainWindowIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_DESKTOP_NOTIFICATION_SENDER" } as const;
    const candidate = payload as Partial<DesktopNotificationToastPayload> | null;
    const validType = candidate?.type === "friend-request" || candidate?.type === "friend-accepted" || candidate?.type === "dm" || candidate?.type === "friend-online" || candidate?.type === "live";
    const validAccent = candidate?.accent === "indigo" || candidate?.accent === "teal" || candidate?.accent === "rose";
    if (!candidate || typeof candidate.notificationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(candidate.notificationId) || !validType || !validAccent || typeof candidate.title !== "string" || typeof candidate.body !== "string" || typeof candidate.closeLabel !== "string" || typeof candidate.soundEnabled !== "boolean") return { ok: false, native: true, error: "INVALID_DESKTOP_NOTIFICATION_TOAST" } as const;
    showDesktopNotificationToast(candidate as DesktopNotificationToastPayload, resolveDesktopNotificationToastPreloadPath());
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.desktopNotificationToastAction, (event, payload: unknown) => {
    if (!isDesktopNotificationToastSender(event) || !payload || typeof payload !== "object") return { ok: false, native: true, error: "UNTRUSTED_DESKTOP_NOTIFICATION_TOAST_SENDER" } as const;
    const value = payload as Record<string, unknown>;
    return handleDesktopNotificationToastAction(value.action, value.notificationId)
      ? { ok: true, native: true } as const
      : { ok: false, native: true, error: "INVALID_DESKTOP_NOTIFICATION_TOAST_ACTION" } as const;
  });

  setIncomingCallToastActionHandler((action, inviteId) => {
    incomingCallPresentationGeneration += 1;
    focusMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IPC_CHANNELS.incomingCallAction, { action, inviteId });
  });

  ipcMain.handle(IPC_CHANNELS.incomingCallShow, async (event, payload: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_INCOMING_CALL_SENDER" } as const;
    const safePayload = parseIncomingCallToastPayload(payload);
    if (!safePayload) return { ok: false, native: true, error: "INVALID_INCOMING_CALL_PAYLOAD" } as const;
    const generation = ++incomingCallPresentationGeneration;
    try {
      const avatar = await prepareNotificationAvatar(safePayload, APP_ICON_PATH);
      if (generation !== incomingCallPresentationGeneration) {
        return { ok: false, native: true, error: "INCOMING_CALL_SUPERSEDED" } as const;
      }
      showIncomingCallToast(
        { ...safePayload, avatarDataUrl: avatar.dataUrl },
        resolveIncomingCallPreloadPath(),
      );
      return { ok: true, native: true } as const;
    } catch {
      return { ok: false, native: true, error: "INCOMING_CALL_SHOW_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.incomingCallDismiss, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_INCOMING_CALL_SENDER" } as const;
    incomingCallPresentationGeneration += 1;
    dismissIncomingCallToast();
    return { ok: true, native: true } as const;
  });

  ipcMain.handle(IPC_CHANNELS.incomingCallRespond, (event, action: unknown) => {
    if (!isIncomingCallToastSender(event)) return { ok: false, native: true, error: "UNTRUSTED_INCOMING_CALL_SENDER" } as const;
    const safeAction = parseIncomingCallToastAction(action);
    if (!safeAction) return { ok: false, native: true, error: "INVALID_INCOMING_CALL_ACTION" } as const;
    handleIncomingCallToastResponse(safeAction);
    return { ok: true, native: true } as const;
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
    if (!isTrustedMainWindowIpcEvent(event) || typeof enabled !== "boolean") {
      return { ok: false, native: true, error: "INVALID_CLOSE_TO_TRAY_STATE" } as const;
    }

    const settings = writeDeviceLocalSettings({
      closeToTray: enabled,
      closeBehavior: enabled ? "tray" : "quit",
    });
    closeToTrayEnabled = settings.closeBehavior === "tray";
    return { ok: true, native: true, enabled: closeToTrayEnabled, supported: Boolean(tray) } as const;
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
    if (!isTrustedMainWindowIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_STARTUP_SENDER" } as const;
    const supported = supportsLoginItemSettings();
    if (!supported) return { ok: true, native: true, supported: false, enabled: false } as const;
    try {
      return { ok: true, native: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin } as const;
    } catch {
      return { ok: false, native: true, error: "STARTUP_STATE_UNAVAILABLE" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.startupSetEnabled, (event, enabled: unknown) => {
    if (!isTrustedMainWindowIpcEvent(event) || typeof enabled !== "boolean") return { ok: false, native: true, error: "INVALID_STARTUP_STATE" } as const;
    if (!app.isPackaged) return { ok: false, native: true, error: "STARTUP_REQUIRES_PACKAGED_APP" } as const;
    if (process.platform !== "win32" && process.platform !== "darwin") return { ok: false, native: true, error: "STARTUP_UNSUPPORTED" } as const;
    try {
      const settings = readDeviceLocalSettings();
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath,
        args: enabled && settings.startupVisibility === "tray" ? [PICOM_LOGIN_STARTUP_FLAG] : [],
      });
      return { ok: true, native: true, supported: true, enabled: app.getLoginItemSettings().openAtLogin } as const;
    } catch {
      return { ok: false, native: true, error: "STARTUP_UPDATE_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.filePickImages, async (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    const window = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;
    const options: OpenDialogOptions = {
      title: "Choose an image",
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "jfif", "webp", "gif", "bmp", "avif", "tif", "tiff", "svg", "heic", "heif"] },
        { name: "All files", extensions: ["*"] }
      ]
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

  ipcMain.handle(IPC_CHANNELS.updateGetState, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, state: getUpdaterState() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.updateCheck, async (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, state: await updaterCheckForUpdates() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.updateDownload, async (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, state: await updaterDownloadUpdate() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.updateInstall, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, state: updaterQuitAndInstall() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.activityGetSnapshot, async (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    const snapshot = await getActivitySnapshot(process.platform);
    return { ok: true, native: true, snapshot } as const;
  });

  ipcMain.handle(IPC_CHANNELS.settingsGet, (event) => {
    if (!isTrustedMainWindowIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, settings: readDeviceLocalSettings() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.settingsSet, (event, partial: unknown) => {
    if (!isTrustedMainWindowIpcEvent(event) || typeof partial !== "object" || partial === null) {
      return { ok: false, native: true, error: "INVALID_SETTINGS_PAYLOAD" } as const;
    }
    const record = partial as Record<string, unknown>;
    const allowed: Partial<{
      selectedMicrophoneId: string | null;
      selectedSpeakerId: string | null;
      selectedCameraId: string | null;
      inputVolume: number;
      outputVolume: number;
      closeToTray: boolean;
      startupVisibility: "normal" | "tray";
      closeBehavior: "tray" | "quit";
      startupDestination: "last" | "feed" | "messages" | "communities";
      lastSafeLocation: "feed" | "messages" | "communities" | null;
      rememberWindowBounds: boolean;
      launchMinimized: boolean;
    }> = {};
    if ("selectedMicrophoneId" in record) {
      allowed.selectedMicrophoneId = typeof record.selectedMicrophoneId === "string" ? record.selectedMicrophoneId : null;
    }
    if ("selectedSpeakerId" in record) {
      allowed.selectedSpeakerId = typeof record.selectedSpeakerId === "string" ? record.selectedSpeakerId : null;
    }
    if ("selectedCameraId" in record) {
      allowed.selectedCameraId = typeof record.selectedCameraId === "string" ? record.selectedCameraId : null;
    }
    if (typeof record.inputVolume === "number") allowed.inputVolume = record.inputVolume;
    if (typeof record.outputVolume === "number") allowed.outputVolume = record.outputVolume;
    if (typeof record.closeToTray === "boolean") {
      allowed.closeToTray = record.closeToTray;
      if (!("closeBehavior" in record)) allowed.closeBehavior = record.closeToTray ? "tray" : "quit";
    }
    if (record.startupVisibility === "normal" || record.startupVisibility === "tray") {
      allowed.startupVisibility = record.startupVisibility;
    }
    if (record.closeBehavior === "tray" || record.closeBehavior === "quit") {
      allowed.closeBehavior = record.closeBehavior;
      allowed.closeToTray = record.closeBehavior === "tray";
    }
    if (record.startupDestination === "last" || record.startupDestination === "feed" || record.startupDestination === "messages" || record.startupDestination === "communities") {
      allowed.startupDestination = record.startupDestination;
    }
    if (record.lastSafeLocation === "feed" || record.lastSafeLocation === "messages" || record.lastSafeLocation === "communities" || record.lastSafeLocation === null) {
      allowed.lastSafeLocation = record.lastSafeLocation;
    }
    if (typeof record.rememberWindowBounds === "boolean") allowed.rememberWindowBounds = record.rememberWindowBounds;
    if (typeof record.launchMinimized === "boolean") {
      allowed.launchMinimized = record.launchMinimized;
      if (!("startupVisibility" in record)) allowed.startupVisibility = record.launchMinimized ? "tray" : "normal";
    }
    if (typeof record.nativeDesktopEnabled === "boolean") (allowed as Record<string, unknown>).nativeDesktopEnabled = record.nativeDesktopEnabled;
    if (typeof record.soundEnabled === "boolean") (allowed as Record<string, unknown>).soundEnabled = record.soundEnabled;
    if (typeof record.notifyWhileFocused === "boolean") (allowed as Record<string, unknown>).notifyWhileFocused = record.notifyWhileFocused;
    if (typeof record.taskbarFlash === "boolean") (allowed as Record<string, unknown>).taskbarFlash = record.taskbarFlash;
    if (typeof record.trayBadge === "boolean") (allowed as Record<string, unknown>).trayBadge = record.trayBadge;
    if (typeof record.titlebarBadge === "boolean") (allowed as Record<string, unknown>).titlebarBadge = record.titlebarBadge;
    if (record.quietHours && typeof record.quietHours === "object") (allowed as Record<string, unknown>).quietHours = record.quietHours;
    const settings = writeDeviceLocalSettings(allowed);
    if (typeof allowed.closeToTray === "boolean" || typeof allowed.closeBehavior === "string") {
      closeToTrayEnabled = settings.closeBehavior === "tray";
    }
    if (typeof allowed.startupVisibility === "string") syncLoginItemArgumentsForVisibility(settings.startupVisibility);
    return { ok: true, native: true, settings } as const;
  });

  ipcMain.handle(IPC_CHANNELS.settingsReset, (event) => {
    if (!isTrustedMainWindowIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, settings: resetDeviceLocalSettings() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.settingsSetLocale, (event, locale: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    // normalizeMainLocale (inside setMainLocale) rejects anything outside the supported
    // set, so an untrusted/corrupt value degrades to English instead of throwing.
    const applied = setMainLocale(locale);
    // Rebuild the tray immediately so menu labels and tooltip follow the new language
    // without an app restart.
    refreshTray();
    return { ok: true, native: true, locale: applied } as const;
  });

  ipcMain.handle(IPC_CHANNELS.cacheGetUsage, (event) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    return { ok: true, native: true, usage: measureCacheUsage() } as const;
  });

  ipcMain.handle(IPC_CHANNELS.cacheClear, async (event, scope: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    const safeScope = scope === "media" || scope === "all" ? scope : "all";
    try {
      const ses = mainWindow?.webContents.session;
      if (ses) {
        if (safeScope === "media") {
          await ses.clearCache();
        } else {
          await ses.clearCache();
          await ses.clearStorageData({
            storages: ["filesystem", "shadercache", "serviceworkers", "cachestorage"],
          });
        }
      }
      return { ok: true, native: true, usage: measureCacheUsage() } as const;
    } catch {
      return { ok: false, native: true, error: "CACHE_CLEAR_FAILED" } as const;
    }
  });

  ipcMain.handle(IPC_CHANNELS.appOpenPath, async (event, target: unknown) => {
    if (!isTrustedIpcEvent(event)) return { ok: false, native: true, error: "UNTRUSTED_IPC_SENDER" } as const;
    if (target !== "logs" && target !== "downloads" && target !== "userData") {
      return { ok: false, native: true, error: "INVALID_OPEN_PATH_TARGET" } as const;
    }
    try {
      const resolved = resolveSafeOpenPath(target as SafeOpenTarget);
      const error = await shell.openPath(resolved);
      if (error) return { ok: false, native: true, error: "OPEN_PATH_FAILED" } as const;
      return { ok: true, native: true, target } as const;
    } catch {
      return { ok: false, native: true, error: "OPEN_PATH_FAILED" } as const;
    }
  });
}

async function createMainWindow({ startHidden = false }: Readonly<{ startHidden?: boolean }> = {}): Promise<void> {
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
    icon: APP_ICON_PATH,
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
    const startInCompanion = companionWindowManager?.shouldStartInCompanionMode() === true;
    if (startInCompanion) {
      companionWindowManager?.enterMode();
    } else if (!startHidden) {
      mainWindow?.show();
    }
    if (mainWindow) {
      sendWindowMaximizeState(mainWindow);
    }
  });

  mainWindow.on("close", (event) => {
    if (shouldInterceptMainWindowClose({ isQuitting, closeBehavior: closeToTrayEnabled ? "tray" : "quit", trayReady: Boolean(tray) })) {
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

// Keep user data in the original "Picom" directory: the display rename to "Picom Desktop"
// (productName) would otherwise move userData to a new folder and existing installs would
// lose sessions/preferences after updating.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// Prefer Windows Graphics Capture so multi-monitor setups enumerate each display
// instead of a single combined "Entire Screen" / "Tüm ekran" source.
if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-features", "WebRTCAllowWgcScreenCapturer");
}

function resolveUserDataPathOverride(): string | null {
  const fromEnv = process.env.PICOM_USER_DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  const arg = process.argv.find((value) => value.startsWith("--user-data-dir="));
  if (arg) {
    const value = arg.slice("--user-data-dir=".length).trim();
    return value || null;
  }
  return null;
}

const userDataOverride = resolveUserDataPathOverride();
// Keep user data in the original "Picom" directory by default: the display rename to
// "Picom Desktop" (productName) would otherwise move userData and drop sessions.
// Isolated smoke/CI runs may override via --user-data-dir or PICOM_USER_DATA_DIR.
app.setPath("userData", userDataOverride || path.join(app.getPath("appData"), "Picom"));
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
    initializeDesktopNotificationToastHost();
    Menu.setApplicationMenu(null);
    registerProtocolHandler();
    registerIpcHandlers();
    companionWindowManager = new CompanionWindowManager(() => mainWindow);
    companionWindowManager.registerIpcHandlers();
    closeToTrayEnabled = readDeviceLocalSettings().closeBehavior === "tray";
    powerMonitor.on("resume", sendPowerResumeToRenderer);

    const initialDeepLink = extractDeepLinkFromArgs(process.argv);
    if (initialDeepLink) {
      pendingDeepLinks.push(initialDeepLink);
    }

    const trayReady = createTray();
    void createMainWindow({ startHidden: shouldStartHiddenInTray(trayReady, Boolean(initialDeepLink)) });
    initUpdater(broadcastUpdaterState);

    app.on("activate", focusMainWindow);
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  companionWindowManager?.closeAll();
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
