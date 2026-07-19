import { app } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";

// Real Picom desktop auto-update, owned exclusively by the Electron main process.
// The renderer never imports this module or electron-updater; it only receives
// normalized, non-sensitive states through the whitelisted IPC bridge.
//
// Policy (see docs/update/real-auto-update-implementation-plan.md):
//   - Disabled by default. Activates only when PICOM_UPDATE_FEED_URL points at an
//     HTTPS feed AND the app is packaged (or PICOM_UPDATE_ALLOW_DEV=1 for local tests).
//   - autoDownload = true, autoInstallOnAppQuit = false  -> download automatically,
//     install only after an explicit, user-approved restart.
//   - Signature/checksum verification stays enabled (electron-updater verifies the
//     SHA-512 from the feed manifest and the Windows publisher signature).

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "download_failed"
  | "ready_to_install"
  | "install_failed"
  | "up_to_date"
  | "error"
  | "unsupported";

export type UpdaterState = Readonly<{
  status: UpdaterStatus;
  enabled: boolean;
  version: string | null;
  releaseChannel: string;
  message: string;
  progress: number | null;
  checkedAt: string | null;
}>;

type StateBroadcaster = (state: UpdaterState) => void;

const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let broadcaster: StateBroadcaster | null = null;
let listenersAttached = false;
let periodicTimer: NodeJS.Timeout | null = null;

function readReleaseChannel(): string {
  const raw = (process.env.PICOM_RELEASE_CHANNEL ?? "").trim().toLowerCase();
  return raw === "beta" || raw === "dev" || raw === "stable" ? raw : "stable";
}

let state: UpdaterState = {
  status: "idle",
  enabled: false,
  version: null,
  releaseChannel: readReleaseChannel(),
  message: "Updater is idle.",
  progress: null,
  checkedAt: null,
};

function readFeedUrl(): string | null {
  const raw = (process.env.PICOM_UPDATE_FEED_URL ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // Transport security is required, but it never replaces artifact signature checks.
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isDevOverrideAllowed(): boolean {
  return process.env.PICOM_UPDATE_ALLOW_DEV === "1";
}

function isSelfUpdatePlatform(): boolean {
  // Windows (NSIS) is the primary target; macOS (zip) also self-updates. Linux
  // package formats are updated by the system package manager, not in-app.
  return process.platform === "win32" || process.platform === "darwin";
}

export function isUpdaterEnabled(): boolean {
  if (!isSelfUpdatePlatform()) return false;
  if (!app.isPackaged && !isDevOverrideAllowed()) return false;
  return readFeedUrl() !== null;
}

function setState(partial: Partial<UpdaterState>): UpdaterState {
  state = { ...state, ...partial };
  broadcaster?.(state);
  return state;
}

function redactedErrorMessage(): string {
  // Detailed updater errors belong only in redacted diagnostics, never the UI.
  return "The update service reported a problem. Your current version is unchanged.";
}

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  autoUpdater.on("checking-for-update", () => {
    setState({ status: "checking", message: "Checking for updates…", checkedAt: new Date().toISOString() });
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    setState({ status: "available", version: info.version ?? null, progress: 0, message: `Update ${info.version ?? ""} is available. Downloading…`.trim() });
  });
  autoUpdater.on("update-not-available", () => {
    setState({ status: "up_to_date", version: null, progress: null, message: "Picom is up to date." });
  });
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
    setState({ status: "downloading", progress: percent, message: `Downloading update… ${percent}%` });
  });
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    setState({ status: "ready_to_install", version: info.version ?? null, progress: 100, message: `Update ${info.version ?? ""} is ready. Restart Picom to install.`.trim() });
  });
  autoUpdater.on("error", () => {
    const wasDownloading = state.status === "downloading" || state.status === "available";
    setState({ status: wasDownloading ? "download_failed" : "error", progress: null, message: redactedErrorMessage() });
  });
}

async function runCheck(): Promise<UpdaterState> {
  if (!state.enabled) return state;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    setState({ status: "error", message: "The update check could not be completed. Your current version is unchanged." });
  }
  return state;
}

export function initUpdater(sendState: StateBroadcaster): UpdaterState {
  broadcaster = sendState;
  const releaseChannel = readReleaseChannel();

  if (!isUpdaterEnabled()) {
    const message = !isSelfUpdatePlatform()
      ? "Automatic updates are provided by your system package manager on this platform."
      : !app.isPackaged && !isDevOverrideAllowed()
        ? "Automatic updates run only in installed builds."
        : "No update feed is configured for this build.";
    return setState({ status: "unsupported", enabled: false, releaseChannel, version: null, progress: null, message });
  }

  try {
    const feedUrl = readFeedUrl();
    if (!feedUrl) {
      return setState({ status: "unsupported", enabled: false, releaseChannel, message: "No update feed is configured for this build." });
    }

    const channel = releaseChannel === "stable" ? "latest" : releaseChannel;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = releaseChannel !== "stable";
    autoUpdater.forceDevUpdateConfig = !app.isPackaged && isDevOverrideAllowed();
    autoUpdater.channel = channel;
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl, channel });
    attachListeners();

    setState({ status: "idle", enabled: true, releaseChannel, message: "Automatic updates are enabled for this channel." });

    void runCheck();
    periodicTimer = setInterval(() => void runCheck(), PERIODIC_CHECK_INTERVAL_MS);
    periodicTimer.unref?.();
  } catch {
    return setState({ status: "error", enabled: false, releaseChannel, message: "The update service could not be initialized." });
  }

  return state;
}

export function getUpdaterState(): UpdaterState {
  return state;
}

export async function checkForUpdates(): Promise<UpdaterState> {
  return runCheck();
}

export async function downloadUpdate(): Promise<UpdaterState> {
  if (!state.enabled) return state;
  if (state.status !== "available" && state.status !== "download_failed") return state;
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    setState({ status: "download_failed", progress: null, message: "Update download failed. No package was installed." });
  }
  return state;
}

export function quitAndInstall(): UpdaterState {
  if (!state.enabled || state.status !== "ready_to_install") {
    return setState({ message: "No downloaded update is ready to install yet." });
  }
  try {
    // Defer so the IPC response can flush before the app relaunches.
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch {
        setState({ status: "install_failed", message: "Update installation failed. The current app remains unchanged." });
      }
    });
    return state;
  } catch {
    return setState({ status: "install_failed", message: "Update installation failed. The current app remains unchanged." });
  }
}

export function disposeUpdater(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}
