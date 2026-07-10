import { appConfig } from "../config/appConfig";
import type { ReleaseChannel } from "../config/releaseChannel";

export type { ReleaseChannel } from "../config/releaseChannel";
export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "download_failed" | "ready_to_install" | "install_failed" | "up_to_date" | "error" | "rollback_available_placeholder";
export type UpdateServiceState = Readonly<{ status: UpdateStatus; appVersion: string; releaseChannel: ReleaseChannel; autoUpdateEnabled: false; message: string; checkedAt: string | null; progress: number | null }>;
type UpdateListener = (state: UpdateServiceState) => void;
const listeners = new Set<UpdateListener>();
let state: UpdateServiceState = { status: "idle", appVersion: appConfig.version, releaseChannel: appConfig.releaseChannel, autoUpdateEnabled: false, message: "Updater is idle. No production endpoint or signing credential is configured.", checkedAt: null, progress: null };
function setState(partial: Partial<UpdateServiceState>): UpdateServiceState { state = { ...state, ...partial }; listeners.forEach((listener) => listener(state)); return state; }

export const updateService = {
  getState(): UpdateServiceState { return state; },
  onStateChange(listener: UpdateListener): () => void { listeners.add(listener); return () => listeners.delete(listener); },
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
