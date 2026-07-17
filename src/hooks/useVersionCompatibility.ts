import { useSyncExternalStore } from "react";
import {
  versionCompatibilityService,
  type VersionCompatibilitySnapshot,
} from "../services/versionCompatibilityService";

// Subscribe to the version-compatibility snapshot. The service compares the running app
// version against the remote-config minimum/recommended versions and re-emits on refresh.
export function useVersionCompatibility(): VersionCompatibilitySnapshot {
  return useSyncExternalStore(
    versionCompatibilityService.subscribe,
    versionCompatibilityService.getSnapshot,
    versionCompatibilityService.getSnapshot,
  );
}
