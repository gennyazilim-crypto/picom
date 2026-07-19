import { appConfig } from "../config/appConfig";
import type { ReleaseChannel } from "../config/releaseChannel";

export type { ReleaseChannel } from "../config/releaseChannel";
export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "download_failed" | "ready_to_install" | "install_failed" | "up_to_date" | "error" | "rollback_available_placeholder";
export type UpdateServiceState = Readonly<{ status: UpdateStatus; appVersion: string; releaseChannel: ReleaseChannel; autoUpdateEnabled: false; message: string; checkedAt: string | null; progress: number | null }>;
type UpdateListener = (state: UpdateServiceState) => void;
const listeners = new Set<UpdateListener>();
let state: UpdateServiceState = { status: "idle", appVersion: appConfig.version, releaseChannel: appConfig.releaseChannel, autoUpdateEnabled: false, message: "Updater is idle. No production endpoint or signing credential is configured.", checkedAt: null, progress: null };
function setState(partial: Partial<UpdateServiceState>): UpdateServiceState { state = { ...state, ...partial }; listeners.forEach((listener) => listener(state)); return state; }

// The renderer never owns the native updater. When Picom runs inside the packaged
// desktop shell with a configured update feed, the Electron main process streams
// normalized, non-sensitive update states through the whitelisted preload bridge
// (`window.picomDesktop.updates`). Outside that shell (browser/dev), the placeholder
// simulation below drives the settings card. `autoUpdateEnabled` stays false because
// installation is never silent — it always waits for an explicit, user-approved restart.
type NativeUpdaterBridge = NonNullable<NonNullable<Window["picomDesktop"]>["updates"]>;
let nativeSubscribed = false;

function getNativeBridge(): NativeUpdaterBridge | null {
  if (typeof window === "undefined") return null;
  return window.picomDesktop?.updates ?? null;
}

function mapNativeStatus(status: PicomUpdaterStatus): UpdateStatus {
  // "unsupported" (no feed / non-self-update platform) is not an error: present it as idle.
  return status === "unsupported" ? "idle" : status;
}

function applyNativeState(native: PicomUpdaterState): UpdateServiceState {
  return setState({
    status: mapNativeStatus(native.status),
    message: native.message,
    progress: native.progress,
    checkedAt: native.checkedAt,
  });
}

function ensureNativeSubscription(): NativeUpdaterBridge | null {
  const bridge = getNativeBridge();
  if (!bridge) return null;
  if (!nativeSubscribed) {
    nativeSubscribed = true;
    bridge.onStateChange((native) => applyNativeState(native));
    void bridge.getState().then((result) => {
      if (result.ok) applyNativeState(result.state);
    });
  }
  return bridge;
}

export const updateService = {
  getState(): UpdateServiceState { return state; },
  onStateChange(listener: UpdateListener): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  // Whether the packaged desktop updater is wired for this session. False in the
  // browser/dev simulation, true when the native bridge is present.
  isNativeUpdaterAvailable(): boolean { return getNativeBridge() !== null; },
  // Connect to the native updater stream if running inside the desktop shell.
  connectNativeUpdates(): boolean { return ensureNativeSubscription() !== null; },
  // Real update actions. They defer to the native updater when available and fall
  // back to the placeholder simulation otherwise.
  async checkForUpdates(): Promise<UpdateServiceState> {
    const bridge = ensureNativeSubscription();
    if (!bridge) return this.checkForUpdatesPlaceholder();
    const result = await bridge.check();
    if (result.ok) return applyNativeState(result.state);
    return setState({ status: "error", message: "The update check could not be started." });
  },
  async downloadUpdate(): Promise<UpdateServiceState> {
    const bridge = ensureNativeSubscription();
    if (!bridge) return this.startDownloadPlaceholder();
    const result = await bridge.download();
    if (result.ok) return applyNativeState(result.state);
    return setState({ status: "download_failed", message: "The update download could not be started.", progress: null });
  },
  async installUpdate(): Promise<UpdateServiceState> {
    const bridge = ensureNativeSubscription();
    if (!bridge) return setState({ status: "install_failed", message: "No native updater is available to install an update.", progress: null });
    const result = await bridge.install();
    if (result.ok) return applyNativeState(result.state);
    return setState({ status: "install_failed", message: "The update installation could not be started.", progress: null });
  },
  async checkForUpdatesPlaceholder(): Promise<UpdateServiceState> { setState({ status: "checking", message: `Checking the ${state.releaseChannel} channel placeholder...`, checkedAt: new Date().toISOString(), progress: null }); return setState({ status: "up_to_date", message: "No signed updater endpoint is configured; this build is treated as up to date." }); },
  setAvailablePlaceholder(): UpdateServiceState { return setState({ status: "available", message: "A signed beta update is available in the local simulation.", progress: 0 }); },
  startDownloadPlaceholder(): UpdateServiceState { if (state.status !== "available" && state.status !== "download_failed") return setState({ status: "error", message: "A download can start only when an update is available.", progress: null }); return setState({ status: "downloading", message: "Downloading signed update placeholder...", progress: 42 }); },
  setReadyToInstallPlaceholder(): UpdateServiceState { return setState({ status: "ready_to_install", message: "Update download simulation is ready to install after restart.", progress: 100 }); },
  setDownloadFailedPlaceholder(): UpdateServiceState { return setState({ status: "download_failed", message: "Update download failed. No package was installed.", progress: null }); },
  setInstallFailedPlaceholder(): UpdateServiceState { return setState({ status: "install_failed", message: "Update installation failed. The current app remains unchanged.", progress: null }); },
  setErrorPlaceholder(): UpdateServiceState { return setState({ status: "error", message: "Updater simulation encountered a recoverable error.", progress: null }); },
  setRollbackAvailablePlaceholder(): UpdateServiceState { return setState({ status: "rollback_available_placeholder", message: "Rollback remains a documented placeholder; no package mutation occurred.", progress: null }); },
  retry(): UpdateServiceState { if (state.status === "download_failed") return this.setAvailablePlaceholder(); if (state.status === "install_failed") return this.setReadyToInstallPlaceholder(); return setState({ status: "idle", message: "Update error cleared. Check again when ready.", progress: null }); },
  clearError(): UpdateServiceState { return setState({ status: "idle", message: "Update status cleared. No update was installed.", progress: null }); },
};

// Auto-connect to the native updater as soon as the module loads inside the desktop
// shell so real update states populate the UI without an explicit user action.
ensureNativeSubscription();
