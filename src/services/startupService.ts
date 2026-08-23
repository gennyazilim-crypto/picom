import { desktopBehaviorService, type DesktopBehaviorPreferences } from "./desktop/desktopBehaviorService";

/** Compatibility facade for existing Settings surfaces. Native state always wins. */
export interface StartupSettings {
  launchOnStartup: boolean;
  startMinimizedToTray: boolean;
  nativeAvailable: boolean;
  mode: "native_ready" | "unsupported" | "unavailable";
  error?: string;
}

function toStartupSettings(state: DesktopBehaviorPreferences): StartupSettings {
  const supported = state.startupCapability === "supported";
  return {
    launchOnStartup: supported ? state.launchAtStartup : false,
    startMinimizedToTray: state.startupVisibility === "tray",
    nativeAvailable: supported,
    mode: supported ? "native_ready" : state.startupCapability === "unavailable" ? "unavailable" : "unsupported",
    ...(supported ? {} : { error: state.startupCapability === "dev-unavailable" ? "STARTUP_REQUIRES_PACKAGED_APP" : "STARTUP_UNSUPPORTED" }),
  };
}

export const startupService = {
  getState(): StartupSettings {
    return toStartupSettings(desktopBehaviorService.getState());
  },

  isLaunchOnStartupEnabled(): boolean {
    return this.getState().launchOnStartup;
  },

  async refreshNativeState(): Promise<StartupSettings> {
    return toStartupSettings(await desktopBehaviorService.refresh());
  },

  async setLaunchOnStartupEnabled(enabled: boolean): Promise<StartupSettings> {
    return toStartupSettings(await desktopBehaviorService.setLaunchAtStartup(enabled));
  },

  toggleLaunchOnStartup(): Promise<StartupSettings> {
    return this.setLaunchOnStartupEnabled(!this.isLaunchOnStartupEnabled());
  },

  async setStartMinimizedToTray(enabled: boolean): Promise<StartupSettings> {
    await desktopBehaviorService.updatePreferences({ startupVisibility: enabled ? "tray" : "normal" });
    return toStartupSettings(desktopBehaviorService.getState());
  },

  async reset(): Promise<StartupSettings> {
    await desktopBehaviorService.updatePreferences({ startupVisibility: "normal" });
    return this.setLaunchOnStartupEnabled(false);
  },
};
