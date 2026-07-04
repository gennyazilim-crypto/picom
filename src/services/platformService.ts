export type PicomRuntime = "electron" | "browser";

export type PicomPlatform = "windows" | "linux" | "macos" | "unknown";

export type PlatformInfo = {
  runtime: PicomRuntime;
  platform: PicomPlatform;
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

export const platformService = {
  getInfo(): PlatformInfo {
    const runtimeInfo = window.picomDesktop?.getRuntimeInfo();

    if (!runtimeInfo) {
      return {
        runtime: "browser",
        platform: "unknown",
        rawPlatform: "browser",
        versions: {}
      };
    }

    return {
      runtime: runtimeInfo.runtime,
      platform: normalizePlatform(runtimeInfo.platform),
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