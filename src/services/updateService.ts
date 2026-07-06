export type UpdateStatus =
  | "idle"
  | "checking"
  | "not_available"
  | "available_placeholder"
  | "download_failed"
  | "install_failed"
  | "rollback_available_placeholder"
  | "disabled";

export type UpdateServiceState = Readonly<{
  status: UpdateStatus;
  appVersion: string;
  releaseChannel: string;
  autoUpdateEnabled: false;
  message: string;
  checkedAt: string | null;
}>;

type UpdateListener = (state: UpdateServiceState) => void;

const listeners = new Set<UpdateListener>();

let state: UpdateServiceState = {
  status: "disabled",
  appVersion: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
  releaseChannel: import.meta.env.VITE_RELEASE_CHANNEL ?? "dev",
  autoUpdateEnabled: false,
  message: "Production auto-update is intentionally disabled for the MVP.",
  checkedAt: null
};

function setState(partial: Partial<UpdateServiceState>): UpdateServiceState {
  state = {
    ...state,
    ...partial
  };

  for (const listener of listeners) {
    listener(state);
  }

  return state;
}

export const updateService = {
  getState(): UpdateServiceState {
    return state;
  },

  onStateChange(listener: UpdateListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  async checkForUpdatesPlaceholder(): Promise<UpdateServiceState> {
    setState({
      status: "checking",
      message: "Checking placeholder update state...",
      checkedAt: new Date().toISOString()
    });

    return setState({
      status: "not_available",
      message: "No updater is configured for this MVP build."
    });
  },

  setDownloadFailedPlaceholder(): UpdateServiceState {
    return setState({
      status: "download_failed",
      message: "Update download failed placeholder. No update was installed."
    });
  },

  setInstallFailedPlaceholder(): UpdateServiceState {
    return setState({
      status: "install_failed",
      message: "Update install failed placeholder. Restart Picom normally or use Safe Mode if needed."
    });
  },

  setRollbackAvailablePlaceholder(): UpdateServiceState {
    return setState({
      status: "rollback_available_placeholder",
      message: "Rollback placeholder is available. Production updater is not enabled for this MVP build."
    });
  }
};
