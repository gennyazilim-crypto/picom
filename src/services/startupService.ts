export interface StartupSettings {
  launchOnStartup: boolean;
  startMinimizedToTray: boolean;
  nativeAvailable: boolean;
  mode: "placeholder" | "native_ready";
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
  localStorage.setItem(startupSettingsKey, JSON.stringify({
    launchOnStartup: settings.launchOnStartup,
    startMinimizedToTray: settings.startMinimizedToTray,
  }));

  return settings;
}

export const startupService = {
  getState(): StartupSettings {
    const stored = readStoredSettings();

    return {
      ...defaults,
      launchOnStartup: Boolean(stored.launchOnStartup),
      startMinimizedToTray: Boolean(stored.startMinimizedToTray),
    };
  },

  isLaunchOnStartupEnabled(): boolean {
    return this.getState().launchOnStartup;
  },

  setLaunchOnStartupEnabled(enabled: boolean): StartupSettings {
    const current = this.getState();
    return persist({
      ...current,
      launchOnStartup: enabled,
      startMinimizedToTray: enabled ? current.startMinimizedToTray : false,
    });
  },

  toggleLaunchOnStartup(): StartupSettings {
    return this.setLaunchOnStartupEnabled(!this.isLaunchOnStartupEnabled());
  },

  setStartMinimizedToTray(enabled: boolean): StartupSettings {
    const current = this.getState();
    return persist({
      ...current,
      launchOnStartup: enabled ? true : current.launchOnStartup,
      startMinimizedToTray: enabled,
    });
  },

  reset(): StartupSettings {
    localStorage.removeItem(startupSettingsKey);
    return this.getState();
  },
};
