import { appConfig } from "../config/appConfig";
import type { ReleaseChannel } from "../config/releaseChannel";

export type { ReleaseChannel } from "../config/releaseChannel";
export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "download_failed" | "ready_to_install" | "install_failed" | "up_to_date" | "error" | "rollback_available_placeholder";
export type UpdateServiceState = Readonly<{
  status: UpdateStatus;
  appVersion: string;
  availableVersion: string | null;
  releaseChannel: ReleaseChannel;
  autoUpdateEnabled: boolean;
  message: string;
  checkedAt: string | null;
  progress: number | null;
}>;

type UpdateListener = (state: UpdateServiceState) => void;
const listeners = new Set<UpdateListener>();
let state: UpdateServiceState = {
  status: "idle",
  appVersion: appConfig.version,
  availableVersion: null,
  releaseChannel: appConfig.releaseChannel,
  autoUpdateEnabled: false,
  message: typeof window !== "undefined" && window.picomDesktop?.updates
    ? "Updater is connected to the desktop release service."
    : "Browser and unpackaged builds use local update simulation. Packaged desktop installs use the signed updater.",
  checkedAt: null,
  progress: null,
};

function setState(partial: Partial<UpdateServiceState>): UpdateServiceState {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener(state));
  return state;
}

type NativeUpdaterBridge = NonNullable<NonNullable<Window["picomDesktop"]>["updates"]>;
let nativeSubscribed = false;

function getNativeBridge(): NativeUpdaterBridge | null {
  if (typeof window === "undefined") return null;
  return window.picomDesktop?.updates ?? null;
}

function mapNativeStatus(status: PicomUpdaterStatus): UpdateStatus {
  return status === "unsupported" ? "idle" : status;
}

function applyNativeState(native: PicomUpdaterState): UpdateServiceState {
  return setState({
    status: mapNativeStatus(native.status),
    availableVersion: native.version,
    autoUpdateEnabled: native.enabled,
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
  isNativeUpdaterAvailable(): boolean { return getNativeBridge() !== null; },
  connectNativeUpdates(): boolean { return ensureNativeSubscription() !== null; },
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
  async checkForUpdatesPlaceholder(): Promise<UpdateServiceState> {
    setState({ status: "checking", message: `Checking the ${state.releaseChannel} development channel...`, checkedAt: new Date().toISOString(), progress: null });
    return setState({ status: "up_to_date", message: "Development builds do not install packaged updates." });
  },
  setAvailablePlaceholder(): UpdateServiceState { return setState({ status: "available", availableVersion: "development-preview", message: "A signed beta update is available in the local simulation.", progress: null }); },
  startDownloadPlaceholder(): UpdateServiceState { if (state.status !== "available" && state.status !== "download_failed") return setState({ status: "error", message: "A download can start only when an update is available.", progress: null }); return setState({ status: "downloading", message: "Downloading signed update placeholder...", progress: 42 }); },
  setReadyToInstallPlaceholder(): UpdateServiceState { return setState({ status: "ready_to_install", message: "Update download simulation is ready to install after restart.", progress: 100 }); },
  setDownloadFailedPlaceholder(): UpdateServiceState { return setState({ status: "download_failed", message: "Update download failed. No package was installed.", progress: null }); },
  setInstallFailedPlaceholder(): UpdateServiceState { return setState({ status: "install_failed", message: "Update installation failed. The current app remains unchanged.", progress: null }); },
  setErrorPlaceholder(): UpdateServiceState { return setState({ status: "error", message: "Updater simulation encountered a recoverable error.", progress: null }); },
  setRollbackAvailablePlaceholder(): UpdateServiceState { return setState({ status: "rollback_available_placeholder", message: "Rollback remains a documented placeholder; no package mutation occurred.", progress: null }); },
  retry(): UpdateServiceState { if (state.status === "download_failed") return this.setAvailablePlaceholder(); if (state.status === "install_failed") return this.setReadyToInstallPlaceholder(); return setState({ status: "idle", message: "Update error cleared. Check again when ready.", progress: null }); },
  clearError(): UpdateServiceState { return setState({ status: "idle", availableVersion: null, message: "Update status cleared. No update was installed.", progress: null }); },
};

ensureNativeSubscription();
