import { appConfig } from "../config/appConfig";
import { remoteConfigService, type ClientRemoteConfig } from "./remoteConfigService";

export type VersionCompatibilityStatus = "supported" | "update_recommended" | "update_required" | "unknown";

export type ParsedSemver = Readonly<{
  major: number;
  minor: number;
  patch: number;
}>;

export type VersionCompatibilitySnapshot = Readonly<{
  currentVersion: string;
  minimumSupportedVersion: string;
  recommendedClientVersion: string;
  latestVersion: string;
  status: VersionCompatibilityStatus;
  blocking: boolean;
  message: string;
  source: ClientRemoteConfig["source"];
  checkedAt: string;
}>;

type VersionCompatibilityListener = (snapshot: VersionCompatibilitySnapshot) => void;

const listeners = new Set<VersionCompatibilityListener>();
let currentSnapshot = evaluateVersionCompatibility(remoteConfigService.getSnapshot());

export function parseSemver(version: string): ParsedSemver | null {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }

  return Object.freeze({
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  });
}

export function compareSemver(leftVersion: string, rightVersion: string): number | null {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  if (!left || !right) {
    return null;
  }

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;
  return 0;
}

function createMessage(status: VersionCompatibilityStatus): string {
  switch (status) {
    case "update_required":
      return "This Picom desktop version is no longer supported. Please update before continuing.";
    case "update_recommended":
      return "A newer Picom desktop version is recommended for the best experience.";
    case "unknown":
      return "Picom could not verify version compatibility, so the app will continue with safe defaults.";
    case "supported":
    default:
      return "This Picom desktop version is supported.";
  }
}

export function evaluateVersionCompatibility(config: ClientRemoteConfig): VersionCompatibilitySnapshot {
  const currentVersion = appConfig.version;
  const minimumCompare = compareSemver(currentVersion, config.minimumSupportedVersion);
  const recommendedCompare = compareSemver(currentVersion, config.recommendedClientVersion);

  let status: VersionCompatibilityStatus = "supported";
  if (minimumCompare === null || recommendedCompare === null) {
    status = "unknown";
  } else if (minimumCompare < 0) {
    status = "update_required";
  } else if (recommendedCompare < 0) {
    status = "update_recommended";
  }

  return Object.freeze({
    currentVersion,
    minimumSupportedVersion: config.minimumSupportedVersion,
    recommendedClientVersion: config.recommendedClientVersion,
    latestVersion: config.latestVersion,
    status,
    blocking: status === "update_required",
    message: createMessage(status),
    source: config.source,
    checkedAt: new Date().toISOString(),
  });
}

function emit(snapshot: VersionCompatibilitySnapshot): VersionCompatibilitySnapshot {
  currentSnapshot = snapshot;
  for (const listener of listeners) {
    listener(currentSnapshot);
  }

  return currentSnapshot;
}

export const versionCompatibilityService = {
  parseSemver,
  compareSemver,
  evaluateVersionCompatibility,

  getSnapshot(): VersionCompatibilitySnapshot {
    return currentSnapshot;
  },

  refreshFromConfig(config = remoteConfigService.getSnapshot()): VersionCompatibilitySnapshot {
    return emit(evaluateVersionCompatibility(config));
  },

  async refreshRemoteConfig(): Promise<VersionCompatibilitySnapshot> {
    const config = await remoteConfigService.refresh();
    return this.refreshFromConfig(config);
  },

  isUpdateRequired(): boolean {
    return currentSnapshot.status === "update_required";
  },

  isUpdateRecommended(): boolean {
    return currentSnapshot.status === "update_recommended";
  },

  subscribe(listener: VersionCompatibilityListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
