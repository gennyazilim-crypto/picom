import { app, BrowserWindow, globalShortcut, ipcMain, screen, type IpcMainInvokeEvent, type Rectangle } from "electron";
import fs from "node:fs";
import path from "node:path";
import { IPC_CHANNELS } from "./ipcChannels.cjs";

const APP_ICON_PATH = path.join(__dirname, "..", "assets", "brand", process.platform === "win32" ? "app-icon.ico" : "app-icon.png");

export type CompanionWindowType = "home" | "chat" | "voice" | "video" | "community" | "dock" | "bubble" | "settings" | "notification" | "gaming";

export type CompanionWindowRequest = Readonly<{
  type: CompanionWindowType;
  conversationId?: string;
  callId?: string;
  communityId?: string;
  channelId?: string;
}>;

type CompanionDockEdge = "left" | "right" | "top" | "bottom";

type CompanionPreferences = Readonly<{
  version: 1;
  startupMode: "main" | "companion";
  alwaysOnTop: boolean;
  compactDensity: boolean;
  closeToTray: boolean;
  showNotifications: boolean;
  theme: "system" | "light" | "dark";
  windowOpacity: number;
  dockEdge: CompanionDockEdge;
  smartCollapse: boolean;
  dockAutoHide: boolean;
  gamingAutoDetect: boolean;
}>;

type PersistedState = Readonly<{
  version: 1;
  preferences: CompanionPreferences;
  windows: Readonly<Record<string, Rectangle>>;
}>;

const DEFAULT_PREFERENCES: CompanionPreferences = Object.freeze({
  version: 1,
  startupMode: "main",
  alwaysOnTop: false,
  compactDensity: false,
  closeToTray: true,
  showNotifications: true,
  theme: "system",
  windowOpacity: 1,
  dockEdge: "right",
  smartCollapse: true,
  dockAutoHide: false,
  gamingAutoDetect: true,
});

const WINDOW_SIZES: Readonly<Record<CompanionWindowType, Readonly<{ width: number; height: number; minWidth: number; minHeight: number }>>> = Object.freeze({
  home: { width: 340, height: 720, minWidth: 340, minHeight: 560 },
  chat: { width: 372, height: 540, minWidth: 340, minHeight: 420 },
  voice: { width: 300, height: 400, minWidth: 280, minHeight: 340 },
  video: { width: 640, height: 420, minWidth: 480, minHeight: 320 },
  community: { width: 680, height: 720, minWidth: 540, minHeight: 520 },
  dock: { width: 56, height: 440, minWidth: 12, minHeight: 200 },
  bubble: { width: 72, height: 72, minWidth: 64, minHeight: 64 },
  settings: { width: 380, height: 640, minWidth: 340, minHeight: 480 },
  notification: { width: 380, height: 168, minWidth: 320, minHeight: 72 },
  gaming: { width: 520, height: 300, minWidth: 360, minHeight: 200 },
});

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;
const SYNC_TOPICS = new Set(["friends", "presence", "direct-messages", "communities", "calls", "preferences", "auth", "quick-reply", "mute-toggle"]);

function snapToEdges(bounds: Rectangle, threshold = 28): Rectangle {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  let { x, y, width, height } = bounds;
  if (Math.abs(x - area.x) <= threshold) x = area.x + 8;
  if (Math.abs(x + width - (area.x + area.width)) <= threshold) x = area.x + area.width - width - 8;
  if (Math.abs(y - area.y) <= threshold) y = area.y + 8;
  if (Math.abs(y + height - (area.y + area.height)) <= threshold) y = area.y + area.height - height - 8;
  return clampBounds({ x, y, width, height });
}

function dockStorageKey(near?: Rectangle): string {
  const display = near ? screen.getDisplayMatching(near) : screen.getPrimaryDisplay();
  return `companion:dock:display:${display.id}`;
}

function isWindowType(value: unknown): value is CompanionWindowType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(WINDOW_SIZES, value);
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error("Invalid Companion window identifier.");
  return value;
}

function validateRequest(value: unknown): CompanionWindowRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Companion window request.");
  const candidate = value as Record<string, unknown>;
  if (!isWindowType(candidate.type)) throw new Error("Unsupported Companion window type.");
  const request: CompanionWindowRequest = {
    type: candidate.type,
    conversationId: optionalId(candidate.conversationId),
    callId: optionalId(candidate.callId),
    communityId: optionalId(candidate.communityId),
    channelId: optionalId(candidate.channelId),
  };
  if (request.type === "chat" && !request.conversationId) throw new Error("A conversation is required for Companion chat.");
  if (request.type === "notification" && !request.conversationId) throw new Error("A conversation is required for Companion notification.");
  if ((request.type === "voice" || request.type === "video") && (!request.conversationId || !request.callId)) {
    throw new Error("A conversation and call are required for Companion calling.");
  }
  if (request.type === "community" && !request.communityId) throw new Error("A community is required for Companion community view.");
  return request;
}

export function companionWindowKey(request: CompanionWindowRequest): string {
  switch (request.type) {
    case "home": return "companion:home";
    case "chat": return `companion:chat:${request.conversationId}`;
    case "voice": return `companion:voice:${request.callId}`;
    case "video": return `companion:video:${request.callId}`;
    case "community": return `companion:community:${request.communityId}:${request.channelId ?? "home"}`;
    case "dock": return "companion:dock";
    case "bubble": return "companion:bubble";
    case "settings": return "companion:settings";
    case "notification": return `companion:notification:${request.conversationId}`;
    case "gaming": return "companion:gaming";
  }
}

function clampBounds(bounds: Rectangle): Rectangle {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const width = Math.min(Math.max(bounds.width, 12), area.width);
  const height = Math.min(Math.max(bounds.height, 12), area.height);
  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - height),
  };
}

function dockBoundsForEdge(edge: CompanionDockEdge, layout: "collapsed" | "rail" | "expanded", near?: Rectangle): Rectangle {
  const display = near ? screen.getDisplayMatching(near) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const minW = WINDOW_SIZES.dock.minWidth;
  const minH = WINDOW_SIZES.dock.minHeight;
  const width = layout === "collapsed" ? minW : layout === "expanded" ? 236 : 56;
  const height = layout === "collapsed" ? Math.min(area.height, Math.max(minH, 520)) : Math.min(area.height - 24, 520);
  if (edge === "left") return clampBounds({ x: area.x + 8, y: area.y + Math.round((area.height - height) / 2), width, height });
  if (edge === "right") return clampBounds({ x: area.x + area.width - width - 8, y: area.y + Math.round((area.height - height) / 2), width, height });
  if (edge === "top") return clampBounds({ x: area.x + Math.round((area.width - Math.max(width, 280)) / 2), y: area.y + 8, width: Math.max(width, 280), height: layout === "collapsed" ? minW : 84 });
  return clampBounds({ x: area.x + Math.round((area.width - Math.max(width, 280)) / 2), y: area.y + area.height - (layout === "collapsed" ? minW + 8 : 92), width: Math.max(width, 280), height: layout === "collapsed" ? minW : 84 });
}

function notificationBounds(near?: Rectangle): Rectangle {
  const display = near ? screen.getDisplayMatching(near) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = 380;
  const height = 168;
  return clampBounds({ x: area.x + area.width - width - 18, y: area.y + 18, width, height });
}

function homeBounds(near?: Rectangle): Rectangle {
  const cursor = screen.getCursorScreenPoint();
  const display = near
    ? screen.getDisplayMatching(near)
    : screen.getDisplayNearestPoint(cursor);
  const area = display.workArea;
  const width = WINDOW_SIZES.home.width;
  const height = Math.min(WINDOW_SIZES.home.height, area.height - 24);
  return clampBounds({
    x: Math.round(area.x + area.width - width - 16),
    y: Math.round(area.y + area.height - height - 16),
    width,
    height,
  });
}

function bubbleBounds(near?: Rectangle): Rectangle {
  const cursor = screen.getCursorScreenPoint();
  const display = near
    ? screen.getDisplayMatching(near)
    : screen.getDisplayNearestPoint(cursor);
  const area = display.workArea;
  const width = WINDOW_SIZES.bubble.width;
  const height = WINDOW_SIZES.bubble.height;
  // Work area already excludes the taskbar — sit in the bottom-right above the clock.
  return clampBounds({
    x: Math.round(area.x + area.width - width - 16),
    y: Math.round(area.y + area.height - height - 16),
    width,
    height,
  });
}


function safeDockEdge(value: unknown): CompanionDockEdge {
  return value === "left" || value === "right" || value === "top" || value === "bottom" ? value : DEFAULT_PREFERENCES.dockEdge;
}

function safeOpacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PREFERENCES.windowOpacity;
  return Math.min(1, Math.max(0.85, Math.round(value * 100) / 100));
}

function safePreferences(value: unknown): CompanionPreferences {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const theme = candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "system" ? candidate.theme : DEFAULT_PREFERENCES.theme;
  const startupMode = candidate.startupMode === "companion" ? "companion" : "main";
  return Object.freeze({
    version: 1,
    startupMode,
    alwaysOnTop: typeof candidate.alwaysOnTop === "boolean" ? candidate.alwaysOnTop : DEFAULT_PREFERENCES.alwaysOnTop,
    compactDensity: typeof candidate.compactDensity === "boolean" ? candidate.compactDensity : DEFAULT_PREFERENCES.compactDensity,
    closeToTray: typeof candidate.closeToTray === "boolean" ? candidate.closeToTray : DEFAULT_PREFERENCES.closeToTray,
    showNotifications: typeof candidate.showNotifications === "boolean" ? candidate.showNotifications : DEFAULT_PREFERENCES.showNotifications,
    theme,
    windowOpacity: (() => {
      const raw = candidate.windowOpacity;
      // One-time migrate legacy washed-out default only.
      if (raw === 0.92) return 1;
      return safeOpacity(raw);
    })(),
    dockEdge: safeDockEdge(candidate.dockEdge),
    smartCollapse: typeof candidate.smartCollapse === "boolean" ? candidate.smartCollapse : DEFAULT_PREFERENCES.smartCollapse,
    dockAutoHide: typeof candidate.dockAutoHide === "boolean" ? candidate.dockAutoHide : DEFAULT_PREFERENCES.dockAutoHide,
    gamingAutoDetect: typeof candidate.gamingAutoDetect === "boolean" ? candidate.gamingAutoDetect : DEFAULT_PREFERENCES.gamingAutoDetect,
  });
}

function safeSyncPayload(value: unknown): Readonly<{ topic: string; revision: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Companion synchronization event.");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.topic !== "string" || !SYNC_TOPICS.has(candidate.topic)) throw new Error("Unsupported Companion synchronization topic.");
  return Object.freeze({ topic: candidate.topic, revision: Date.now() });
}

export class CompanionWindowManager {
  readonly #windows = new Map<string, BrowserWindow>();
  readonly #contexts = new Map<number, Readonly<CompanionWindowRequest & { key: string }>>();
  readonly #getMainWindow: () => BrowserWindow | null;
  readonly #statePath: string;
  #state: PersistedState;
  #saveTimers = new Map<string, NodeJS.Timeout>();
  #gamingPoll: ReturnType<typeof setInterval> | null = null;
  #gamingActive = false;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.#getMainWindow = getMainWindow;
    this.#statePath = path.join(app.getPath("userData"), "companion-window-state.v1.json");
    this.#state = this.#readState();
    this.#syncGamingDetector();
  }

  registerIpcHandlers(): void {
    const register = (channel: string, handler: (event: IpcMainInvokeEvent, payload?: unknown) => unknown) => {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, handler);
    };
    register(IPC_CHANNELS.companionGetContext, (event) => this.#contexts.get(event.sender.id) ?? null);
    register(IPC_CHANNELS.companionEnterMode, () => this.enterMode());
    register(IPC_CHANNELS.companionOpenWindow, (_event, payload) => this.openWindow(validateRequest(payload)));
    register(IPC_CHANNELS.companionCloseWindow, (event) => {
      if (!this.#contexts.has(event.sender.id)) return false;
      const current = BrowserWindow.fromWebContents(event.sender);
      const context = this.#contexts.get(event.sender.id);
      if (!current || current.isDestroyed() || !context) return false;
      const hideable = context.type === "home" || context.type === "dock";
      if (this.#state.preferences.closeToTray && hideable) current.hide();
      else current.close();
      return true;
    });
    register(IPC_CHANNELS.companionReturnToMain, () => this.returnToMain());
    register(IPC_CHANNELS.companionGetPreferences, () => this.#state.preferences);
    register(IPC_CHANNELS.companionSetPreferences, (_event, payload) => this.setPreferences(payload));
    register(IPC_CHANNELS.companionSetAlwaysOnTop, (event, payload) => {
      if (!this.#contexts.has(event.sender.id)) throw new Error("Companion context required.");
      const enabled = typeof payload === "boolean"
        ? payload
        : Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && (payload as { value?: unknown }).value === true);
      const persistGlobal = Boolean(
        payload
        && typeof payload === "object"
        && !Array.isArray(payload)
        && (payload as { persistGlobal?: unknown }).persistGlobal === true,
      );
      const current = BrowserWindow.fromWebContents(event.sender);
      current?.setAlwaysOnTop(enabled, "floating");
      if (persistGlobal) return this.setPreferences({ alwaysOnTop: enabled });
      return this.#state.preferences;
    });
    register(IPC_CHANNELS.companionBroadcast, (event, payload) => {
      const syncEvent = safeSyncPayload(payload);
      this.broadcast(syncEvent, event.sender.id);
      return syncEvent;
    });
    register(IPC_CHANNELS.companionSetDockLayout, (event, payload) => {
      if (!this.#contexts.has(event.sender.id)) return Object.freeze({ ok: false as const });
      const layout = payload === "collapsed" || payload === "rail" || payload === "expanded" ? payload : "rail";
      const current = BrowserWindow.fromWebContents(event.sender);
      if (!current || current.isDestroyed()) return Object.freeze({ ok: false as const });
      const bounds = dockBoundsForEdge(this.#state.preferences.dockEdge, layout, current.getBounds());
      current.setBounds(bounds, true);
      this.#persistWindowBounds("companion:dock", current, true);
      return Object.freeze({ ok: true as const, layout, bounds });
    });
    register(IPC_CHANNELS.companionSetWindowBounds, (event, payload) => {
      if (!this.#contexts.has(event.sender.id)) return Object.freeze({ ok: false as const });
      const current = BrowserWindow.fromWebContents(event.sender);
      if (!current || current.isDestroyed()) return Object.freeze({ ok: false as const });
      const patch = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const currentBounds = current.getBounds();
      const next = clampBounds({
        x: typeof patch.x === "number" ? patch.x : currentBounds.x,
        y: typeof patch.y === "number" ? patch.y : currentBounds.y,
        width: typeof patch.width === "number" ? Math.round(patch.width) : currentBounds.width,
        height: typeof patch.height === "number" ? Math.round(patch.height) : currentBounds.height,
      });
      current.setBounds(next, true);
      if (typeof patch.alwaysOnTop === "boolean") current.setAlwaysOnTop(patch.alwaysOnTop, "floating");
      const context = this.#contexts.get(event.sender.id);
      if (context) this.#persistWindowBounds(context.key, current);
      return Object.freeze({ ok: true as const, bounds: next });
    });
    register(IPC_CHANNELS.companionSetClickThrough, (event, payload) => {
      if (!this.#contexts.has(event.sender.id)) return Object.freeze({ ok: false as const });
      const current = BrowserWindow.fromWebContents(event.sender);
      if (!current || current.isDestroyed()) return Object.freeze({ ok: false as const });
      const enabled = payload === true;
      current.setIgnoreMouseEvents(enabled, { forward: true });
      return Object.freeze({ ok: true as const, enabled });
    });

    try {
      globalShortcut.register("CommandOrControl+Shift+C", () => {
        this.toggleMode();
      });
      globalShortcut.register("CommandOrControl+Shift+Y", () => {
        this.broadcast({ topic: "quick-reply", revision: Date.now() });
      });
      globalShortcut.register("CommandOrControl+Shift+M", () => {
        this.broadcast({ topic: "mute-toggle", revision: Date.now() });
      });
    } catch (error) {
      console.warn("Could not register Companion shortcuts.", error instanceof Error ? error.message : "unknown error");
    }
  }

  shouldStartInCompanionMode(): boolean {
    return this.#state.preferences.startupMode === "companion";
  }

  getPreferences(): CompanionPreferences {
    return this.#state.preferences;
  }

  openWindow(request: CompanionWindowRequest): Readonly<{ key: string; created: boolean }> {
    const validRequest = validateRequest(request);
    const key = companionWindowKey(validRequest);
    const existing = this.#windows.get(key);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      if (validRequest.type === "bubble") {
        const next = bubbleBounds(this.#getMainWindow()?.getBounds() ?? existing.getBounds());
        existing.setBounds(next, false);
        existing.setPosition(next.x, next.y);
      } else if (validRequest.type === "home") {
        const next = homeBounds(this.#getMainWindow()?.getBounds() ?? existing.getBounds());
        existing.setBounds(next, false);
        existing.setPosition(next.x, next.y);
      }
      existing.show();
      existing.focus();
      return Object.freeze({ key, created: false });
    }

    const size = WINDOW_SIZES[validRequest.type];
    const dockKey = validRequest.type === "dock" ? dockStorageKey() : key;
    const saved = validRequest.type === "bubble" || validRequest.type === "home"
      ? undefined
      : this.#state.windows[validRequest.type === "dock" ? dockKey : key] ?? (validRequest.type === "dock" ? this.#state.windows[key] : undefined);
    let bounds = saved ? clampBounds(saved) : undefined;
    if (validRequest.type === "dock") {
      bounds = dockBoundsForEdge(this.#state.preferences.dockEdge, "rail", bounds);
    } else if (validRequest.type === "notification") {
      bounds = notificationBounds(this.#getMainWindow()?.getBounds());
    } else if (validRequest.type === "bubble") {
      bounds = bubbleBounds(this.#getMainWindow()?.getBounds());
    } else if (validRequest.type === "home") {
      bounds = homeBounds(this.#getMainWindow()?.getBounds());
    }
    const window = new BrowserWindow({
      width: bounds?.width ?? size.width,
      height: bounds?.height ?? size.height,
      x: bounds?.x,
      y: bounds?.y,
      minWidth: size.minWidth,
      minHeight: size.minHeight,
      frame: false,
      show: false,
      transparent: validRequest.type === "bubble" || validRequest.type === "gaming" || validRequest.type === "notification",
      backgroundColor: validRequest.type === "bubble" || validRequest.type === "gaming" || validRequest.type === "notification" ? "#00000000" : "#FFFFFF",
      alwaysOnTop: validRequest.type === "dock" || validRequest.type === "bubble" || validRequest.type === "notification" || validRequest.type === "gaming" || this.#state.preferences.alwaysOnTop,
      skipTaskbar: validRequest.type === "bubble" || validRequest.type === "notification" || validRequest.type === "gaming",
      focusable: validRequest.type !== "gaming",
      title: `Picom Companion ${validRequest.type}`,
      icon: APP_ICON_PATH,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
      },
    });

    const webContentsId = window.webContents.id;
    this.#windows.set(key, window);
    this.#contexts.set(webContentsId, Object.freeze({ ...validRequest, key }));
    const isTransparent = validRequest.type === "bubble" || validRequest.type === "gaming" || validRequest.type === "notification";
    window.setOpacity(isTransparent ? 1 : this.#state.preferences.windowOpacity);
    if (validRequest.type === "gaming") {
      window.setIgnoreMouseEvents(true, { forward: true });
    }
    if ((validRequest.type === "bubble" || validRequest.type === "home") && bounds) {
      window.setBounds(bounds, false);
      window.setPosition(bounds.x, bounds.y);
    }
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      try {
        const current = window.webContents.getURL();
        if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault();
      } catch {
        event.preventDefault();
      }
    });
    window.once("ready-to-show", () => {
      if (validRequest.type === "bubble" || validRequest.type === "home") {
        const next = validRequest.type === "bubble"
          ? bubbleBounds(this.#getMainWindow()?.getBounds() ?? window.getBounds())
          : homeBounds(this.#getMainWindow()?.getBounds() ?? window.getBounds());
        window.setBounds(next, false);
        window.setPosition(next.x, next.y);
      }
      if (validRequest.type === "gaming" || validRequest.type === "notification") window.showInactive();
      else window.show();
    });
    const persistBounds = () => {
      if (validRequest.type === "bubble" || validRequest.type === "notification" || validRequest.type === "home") return;
      this.#scheduleBoundsSave(validRequest.type === "dock" ? "companion:dock" : key, window);
    };
    window.on("move", persistBounds);
    window.on("resize", persistBounds);
    if (validRequest.type === "chat" || validRequest.type === "voice" || validRequest.type === "video") {
      window.on("moved", () => {
        if (window.isDestroyed()) return;
        const snapped = snapToEdges(window.getBounds());
        const current = window.getBounds();
        if (snapped.x !== current.x || snapped.y !== current.y) window.setBounds(snapped, true);
      });
    }
    window.on("closed", () => {
      this.#contexts.delete(webContentsId);
      this.#windows.delete(key);
      if (validRequest.type === "gaming") this.#gamingActive = false;
    });

    const query = Object.fromEntries(Object.entries({
      picomWindow: "companion",
      type: validRequest.type,
      conversationId: validRequest.conversationId,
      callId: validRequest.callId,
      communityId: validRequest.communityId,
      channelId: validRequest.channelId,
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    if (app.isPackaged) {
      void window.loadFile(path.join(app.getAppPath(), "dist", "index.html"), { query });
    } else {
      const rendererUrl = new URL(process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173/");
      Object.entries(query).forEach(([name, value]) => rendererUrl.searchParams.set(name, value));
      void window.loadURL(rendererUrl.toString());
    }
    return Object.freeze({ key, created: true });
  }

  enterMode(): Readonly<{ key: string; created: boolean; mainWindowHidden: boolean }> {
    // Destroy stale ephemeral windows; only restore home (and dock if present).
    for (const [key, companionWindow] of [...this.#windows.entries()]) {
      if (companionWindow.isDestroyed()) {
        this.#windows.delete(key);
        continue;
      }
      const contextEntry = [...this.#contexts.entries()].find(([, item]) => item.key === key);
      const context = contextEntry?.[1];
      const keep = context?.type === "home" || context?.type === "dock" || key === "companion:home" || key === "companion:dock" || key.startsWith("companion:dock:");
      if (!keep) {
        companionWindow.destroy();
        this.#windows.delete(key);
        if (contextEntry) this.#contexts.delete(contextEntry[0]);
      }
    }
    const home = this.#windows.get("companion:home");
    if (home && !home.isDestroyed()) home.show();
    const result = this.openWindow({ type: "home" });
    const mainWindow = this.#getMainWindow();
    let mainWindowHidden = false;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      mainWindowHidden = true;
    }

    return Object.freeze({ ...result, mainWindowHidden });
  }

  returnToMain(): boolean {
    const main = this.#getMainWindow();
    if (!main || main.isDestroyed()) return false;
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
    for (const companionWindow of this.#windows.values()) {
      if (!companionWindow.isDestroyed()) companionWindow.hide();
    }
    return true;
  }

  toggleMode(): Readonly<{ key?: string; created?: boolean; mainWindowHidden?: boolean; toggledTo: "main" | "companion" }> {
    const main = this.#getMainWindow();
    const mainHidden = Boolean(main && !main.isDestroyed() && !main.isVisible());
    if (mainHidden) {
      const result = this.openWindow({ type: "home" });
      return Object.freeze({ ...result, mainWindowHidden: true, toggledTo: "companion" as const });
    }
    return Object.freeze({ ...this.enterMode(), toggledTo: "companion" as const });
  }

  setPreferences(payload: unknown): CompanionPreferences {
    const patch = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    const previousEdge = this.#state.preferences.dockEdge;
    const previousGaming = this.#state.preferences.gamingAutoDetect;
    this.#state = Object.freeze({ ...this.#state, preferences: safePreferences({ ...this.#state.preferences, ...patch }) });
    for (const [key, window] of this.#windows) {
      if (!window.isDestroyed()) {
        const transparent = key === "companion:bubble" || key === "companion:gaming" || key.startsWith("companion:notification:");
        window.setOpacity(transparent ? 1 : this.#state.preferences.windowOpacity);
        window.setAlwaysOnTop(
          key === "companion:dock"
          || key === "companion:bubble"
          || key.startsWith("companion:notification:")
          || key === "companion:gaming"
          || this.#state.preferences.alwaysOnTop,
          "floating",
        );
      }
    }
    if (previousEdge !== this.#state.preferences.dockEdge) {
      const dock = this.#windows.get("companion:dock");
      if (dock && !dock.isDestroyed()) dock.setBounds(dockBoundsForEdge(this.#state.preferences.dockEdge, "rail", dock.getBounds()), true);
    }
    if (previousGaming !== this.#state.preferences.gamingAutoDetect) {
      this.#syncGamingDetector();
    }
    this.#writeState();
    this.broadcast({ topic: "preferences", revision: Date.now() });
    return this.#state.preferences;
  }

  #persistWindowBounds(key: string, window: BrowserWindow, immediate = false): void {
    const save = () => {
      if (window.isDestroyed() || window.isMinimized() || window.isMaximized()) return;
      const persistKey = key === "companion:dock" ? dockStorageKey(window.getBounds()) : key;
      this.#state = Object.freeze({ ...this.#state, windows: Object.freeze({ ...this.#state.windows, [persistKey]: window.getBounds() }) });
      this.#writeState();
    };
    if (immediate) {
      save();
      return;
    }
    this.#scheduleBoundsSave(key === "companion:dock" ? dockStorageKey(window.getBounds()) : key, window);
  }

  broadcast(payload: Readonly<{ topic: string; revision: number }>, excludedWebContentsId?: number): void {
    for (const window of this.#windows.values()) {
      if (!window.isDestroyed() && window.webContents.id !== excludedWebContentsId) {
        window.webContents.send(IPC_CHANNELS.companionEvent, payload);
      }
    }
  }

  closeAll(): void {
    this.#stopGamingDetector();
    for (const accelerator of ["CommandOrControl+Shift+C", "CommandOrControl+Shift+Y", "CommandOrControl+Shift+M"]) {
      try {
        globalShortcut.unregister(accelerator);
      } catch {
        /* ignore */
      }
    }
    const windows = [...this.#windows.values()];
    this.#windows.clear();
    this.#contexts.clear();
    for (const companionWindow of windows) {
      if (!companionWindow.isDestroyed()) companionWindow.destroy();
    }
  }

  #syncGamingDetector(): void {
    this.#stopGamingDetector();
    if (!this.#state.preferences.gamingAutoDetect) {
      if (this.#gamingActive) this.#leaveGamingMode();
      return;
    }
    this.#gamingPoll = setInterval(() => this.#evaluateGamingMode(), 2500);
    this.#evaluateGamingMode();
  }

  #stopGamingDetector(): void {
    if (this.#gamingPoll) {
      clearInterval(this.#gamingPoll);
      this.#gamingPoll = null;
    }
  }

  #isLikelyFullscreenExclusive(): boolean {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) return false;
    try {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const { width, height } = display.bounds;
      const work = display.workArea;
      // Exclusive fullscreen often collapses the usable work area to the full display.
      return work.width >= width - 2 && work.height >= height - 2;
    } catch {
      return false;
    }
  }

  #evaluateGamingMode(): void {
    if (!this.#state.preferences.gamingAutoDetect) return;
    const likely = this.#isLikelyFullscreenExclusive();
    if (likely && !this.#gamingActive) {
      this.#gamingActive = true;
      const home = this.#windows.get("companion:home");
      if (home && !home.isDestroyed() && home.isVisible()) home.hide();
      this.openWindow({ type: "gaming" });
      return;
    }
    if (!likely && this.#gamingActive) this.#leaveGamingMode();
  }

  #leaveGamingMode(): void {
    this.#gamingActive = false;
    const gaming = this.#windows.get("companion:gaming");
    if (gaming && !gaming.isDestroyed()) gaming.close();
  }

  #scheduleBoundsSave(key: string, window: BrowserWindow): void {
    const persistKey = key.startsWith("companion:dock") ? dockStorageKey(window.getBounds()) : key;
    const existing = this.#saveTimers.get(persistKey);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.#saveTimers.delete(persistKey);
      if (window.isDestroyed() || window.isMinimized() || window.isMaximized()) return;
      const nextKey = persistKey.startsWith("companion:dock") ? dockStorageKey(window.getBounds()) : persistKey;
      this.#state = Object.freeze({ ...this.#state, windows: Object.freeze({ ...this.#state.windows, [nextKey]: window.getBounds() }) });
      this.#writeState();
    }, 250);
    this.#saveTimers.set(persistKey, timer);
  }

  #readState(): PersistedState {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.#statePath, "utf8")) as Record<string, unknown>;
      const rawWindows = parsed.windows && typeof parsed.windows === "object" && !Array.isArray(parsed.windows)
        ? parsed.windows as Record<string, unknown>
        : {};
      const windows: Record<string, Rectangle> = {};
      for (const [key, value] of Object.entries(rawWindows)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const rect = value as Record<string, unknown>;
        const x = rect.x;
        const y = rect.y;
        const width = rect.width;
        const height = rect.height;
        if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
        windows[key] = { x: x as number, y: y as number, width: width as number, height: height as number };
      }
      return Object.freeze({ version: 1, preferences: safePreferences(parsed.preferences), windows: Object.freeze(windows) });
    } catch {
      return Object.freeze({ version: 1, preferences: DEFAULT_PREFERENCES, windows: Object.freeze({}) });
    }
  }

  #writeState(): void {
    try {
      fs.mkdirSync(path.dirname(this.#statePath), { recursive: true });
      const temporaryPath = `${this.#statePath}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(this.#state, null, 2), { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temporaryPath, this.#statePath);
    } catch (error) {
      console.warn("Could not persist Companion window state.", error instanceof Error ? error.message : "unknown error");
    }
  }
}
