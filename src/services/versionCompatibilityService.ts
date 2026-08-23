import { appConfig } from "../config/appConfig";
import { remoteConfigService, type ClientRemoteConfig } from "./remoteConfigService";
import {
  compareSemver,
  evaluateVersionCompatibility as evaluateAgainstCurrentVersion,
  parseSemver,
  type VersionCompatibilitySnapshot,
  type VersionCompatibilityStatus,
} from "./versionSemver";

export type { ParsedSemver, VersionCompatibilitySnapshot, VersionCompatibilityStatus } from "./versionSemver";
export { compareSemver, parseSemver };

type VersionCompatibilityListener = (snapshot: VersionCompatibilitySnapshot) => void;

const listeners = new Set<VersionCompatibilityListener>();
let currentSnapshot = evaluateVersionCompatibility(remoteConfigService.getSnapshot());

export function evaluateVersionCompatibility(
  config: ClientRemoteConfig,
  currentVersion = appConfig.version,
): VersionCompatibilitySnapshot {
  return evaluateAgainstCurrentVersion(config, currentVersion);
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
