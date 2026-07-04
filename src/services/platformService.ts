export type PicomRuntime = "electron" | "browser";

export type PicomPlatform = "windows" | "linux" | "macos" | "unknown";

export type PlatformInfo = {
  runtime: PicomRuntime;
  runtimeLabel: string;
  platform: PicomPlatform;
  platformLabel: string;
  rawPlatform: string;
  versions: {
    electron?: string;
    chrome?: string;
    node?: string;
  };
};

function normalizePlatform(rawPlatform: string | undefined): PicomPlatform {
  if (rawPlatform === "win32") {
    return "windows";
  }

  if (rawPlatform === "linux") {
    return "linux";
  }

  if (rawPlatform === "darwin") {
    return "macos";
  }

  return "unknown";
}

function getPlatformLabel(platform: PicomPlatform): string {
  if (platform === "windows") {
    return "Windows";
  }

  if (platform === "linux") {
    return "Linux";
  }

  if (platform === "macos") {
    return "macOS";
  }

  return "Unknown platform";
}

function getRuntimeLabel(runtime: PicomRuntime): string {
  if (runtime === "electron") {
    return "Electron desktop";
  }

  return "Browser fallback";
}

export const platformService = {
  getInfo(): PlatformInfo {
    const runtimeInfo = window.picomDesktop?.getRuntimeInfo();

    if (!runtimeInfo) {
      return {
        runtime: "browser",
        runtimeLabel: getRuntimeLabel("browser"),
        platform: "unknown",
        platformLabel: getPlatformLabel("unknown"),
        rawPlatform: "browser",
        versions: {}
      };
    }

    const platform = normalizePlatform(runtimeInfo.platform);

    return {
      runtime: runtimeInfo.runtime,
      runtimeLabel: getRuntimeLabel(runtimeInfo.runtime),
      platform,
      platformLabel: getPlatformLabel(platform),
      rawPlatform: runtimeInfo.platform,
      versions: runtimeInfo.versions
    };
  },

  isElectron(): boolean {
    return this.getInfo().runtime === "electron";
  },

  isDesktopRuntime(): boolean {
    return this.isElectron();
  }
};