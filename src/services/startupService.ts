export interface StartupSettings {
  launchOnStartup: boolean;
  startMinimizedToTray: boolean;
  nativeAvailable: boolean;
  mode: "placeholder" | "native_ready" | "unsupported";
  error?: string;
}

const startupSettingsKey = "picom-startup-settings";

const defaults: StartupSettings = {
  launchOnStartup: false,
  startMinimizedToTray: false,
  nativeAvailable: false,
  mode: "placeholder",
};

function readStoredSettings(): Partial<StartupSettings> {
  try {
    return JSON.parse(localStorage.getItem(startupSettingsKey) ?? "{}") as Partial<StartupSettings>;
  } catch {
    return {};
  }
}

function persist(settings: StartupSettings): StartupSettings {
  try {
    localStorage.setItem(startupSettingsKey, JSON.stringify({
      launchOnStartup: settings.launchOnStartup,
      startMinimizedToTray: settings.startMinimizedToTray,
    }));
  } catch { /* safe restricted fallback */ }

  return settings;
}

export const startupService = {
  getState(): StartupSettings {
    const stored = readStoredSettings();
    const nativeAvailable = Boolean(window.picomDesktop?.startup);

    return {
      ...defaults,
      launchOnStartup: Boolean(stored.launchOnStartup),
      startMinimizedToTray: Boolean(stored.startMinimizedToTray),
      nativeAvailable,
      mode: nativeAvailable ? "native_ready" : "placeholder",
    };
  },

  isLaunchOnStartupEnabled(): boolean {
    return this.getState().launchOnStartup;
  },

  async refreshNativeState(): Promise<StartupSettings> {
    const current = this.getState();
    const bridge = window.picomDesktop?.startup;
    if (!bridge) return current;
    const result = await bridge.getState().catch(() => ({ ok: false as const, native: true as const, error: "STARTUP_STATE_UNAVAILABLE" }));
    if (!result.ok || !result.supported) return persist({ ...current, launchOnStartup: false, startMinimizedToTray: false, nativeAvailable: false, mode: "unsupported", error: result.ok ? "STARTUP_UNSUPPORTED" : result.error });
    return persist({ ...current, launchOnStartup: result.enabled, startMinimizedToTray: result.enabled && current.startMinimizedToTray, nativeAvailable: true, mode: "native_ready", error: undefined });
  },

  async setLaunchOnStartupEnabled(enabled: boolean): Promise<StartupSettings> {
    const current = this.getState();
    const bridge = window.picomDesktop?.startup;
    if (!bridge) return persist({ ...current, launchOnStartup: enabled, startMinimizedToTray: enabled ? current.startMinimizedToTray : false, mode: "placeholder" });
    const result = await bridge.setEnabled(enabled).catch(() => ({ ok: false as const, native: true as const, error: "STARTUP_UPDATE_FAILED" }));
    if (!result.ok) return persist({ ...current, launchOnStartup: false, startMinimizedToTray: false, nativeAvailable: false, mode: "unsupported", error: result.error });
    return persist({ ...current, launchOnStartup: result.enabled, startMinimizedToTray: result.enabled ? current.startMinimizedToTray : false, nativeAvailable: true, mode: "native_ready", error: undefined });
  },

  toggleLaunchOnStartup(): Promise<StartupSettings> {
    return this.setLaunchOnStartupEnabled(!this.isLaunchOnStartupEnabled());
  },

  async setStartMinimizedToTray(enabled: boolean): Promise<StartupSettings> {
    let current = this.getState();
    if (enabled && !current.launchOnStartup) current = await this.setLaunchOnStartupEnabled(true);
    if (enabled && !current.launchOnStartup) return current;
    return persist({
      ...current,
      startMinimizedToTray: enabled,
    });
  },

  async reset(): Promise<StartupSettings> {
    localStorage.removeItem(startupSettingsKey);
    return this.setLaunchOnStartupEnabled(false);
  },
};
