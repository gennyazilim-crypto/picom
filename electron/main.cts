import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import path from "node:path";
import { ELECTRON_APP_CONFIG } from "./appConfig.cjs";
import { IPC_CHANNELS } from "./ipcChannels.cjs";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

type WindowAction = "minimize" | "maximize" | "close";

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
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: ELECTRON_APP_CONFIG.window.defaultWidth,
    height: ELECTRON_APP_CONFIG.window.defaultHeight,
    minWidth: ELECTRON_APP_CONFIG.window.minWidth,
    minHeight: ELECTRON_APP_CONFIG.window.minHeight,
    show: false,
    frame: false,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
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
