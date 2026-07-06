import { appConfig } from "../config/appConfig";
import {
  featureFlagService,
  type FeatureAvailability,
  type FeatureFlagKey,
} from "./featureFlagService";
import { loggingService } from "./loggingService";

export const EMERGENCY_KILL_SWITCH_KEYS = [
  "disableRealtime",
  "disableUploads",
  "disableVoiceRooms",
  "disableDiscovery",
  "disableWebhooks",
  "disableBots",
  "disableNativeNotifications",
  "disableAutoUpdate",
  "disableMessageEditing",
  "disableInvites",
] as const;

export type EmergencyKillSwitchKey = (typeof EMERGENCY_KILL_SWITCH_KEYS)[number];
export type EmergencyKillSwitches = Readonly<Record<EmergencyKillSwitchKey, boolean>>;
export type EmergencyKillSwitchOverrides = Partial<Record<EmergencyKillSwitchKey, boolean>>;
export type EmergencyKillSwitchSource = "defaults" | "environment" | "remote" | "runtime";

export type EmergencyKillSwitchSnapshot = Readonly<{
  switches: EmergencyKillSwitches;
  sources: Partial<Record<EmergencyKillSwitchKey, EmergencyKillSwitchSource>>;
  updatedAt: string;
}>;

export type KillSwitchFeatureAvailability = FeatureAvailability &
  Readonly<{
    killSwitch?: EmergencyKillSwitchKey;
  }>;

type EmergencyKillSwitchListener = (snapshot: EmergencyKillSwitchSnapshot) => void;

const keySet = new Set<string>(EMERGENCY_KILL_SWITCH_KEYS);
const listeners = new Set<EmergencyKillSwitchListener>();
let remoteOverrides: EmergencyKillSwitchOverrides = {};
let runtimeOverrides: EmergencyKillSwitchOverrides = {};

const FEATURE_TO_KILL_SWITCH: Partial<Record<FeatureFlagKey, EmergencyKillSwitchKey>> = {
  enableRealtime: "disableRealtime",
  enableVoiceRooms: "disableVoiceRooms",
  enableDiscovery: "disableDiscovery",
  enableWebhooks: "disableWebhooks",
  enableBots: "disableBots",
  enableAutoUpdate: "disableAutoUpdate",
};

function createDefaultKillSwitches(): EmergencyKillSwitches {
  return Object.freeze({
    disableRealtime: false,
    disableUploads: false,
    disableVoiceRooms: false,
    disableDiscovery: false,
    disableWebhooks: false,
    disableBots: false,
    disableNativeNotifications: false,
    disableAutoUpdate: false,
    disableMessageEditing: false,
    disableInvites: false,
  });
}

function isEmergencyKillSwitchKey(value: string): value is EmergencyKillSwitchKey {
  return keySet.has(value);
}

function parseBooleanSwitch(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "enabled", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "off", "disabled", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

function sanitizeOverrides(input: unknown, source: EmergencyKillSwitchSource): EmergencyKillSwitchOverrides {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const next: EmergencyKillSwitchOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isEmergencyKillSwitchKey(key)) {
      loggingService.logWarn("Ignoring unknown emergency kill switch key", { key, source }, "kill-switches");
      continue;
    }

    const parsed = parseBooleanSwitch(value);
    if (parsed === null) {
      loggingService.logWarn("Ignoring invalid emergency kill switch value", { key, source }, "kill-switches");
      continue;
    }

    next[key] = parsed;
  }

  return next;
}

function parseDelimitedOverrides(raw: string): EmergencyKillSwitchOverrides {
  const entries: Record<string, string> = {};
  for (const part of raw.split(/[;,]/)) {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    const value = rawValue.join("=").trim();
    if (key && value) {
      entries[key] = value;
    }
  }

  return sanitizeOverrides(entries, "environment");
}

function parseEnvironmentOverrides(): EmergencyKillSwitchOverrides {
  const rawValue = import.meta.env.VITE_EMERGENCY_KILL_SWITCHES;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return {};
  }

  const raw = rawValue.trim();
  if (raw.startsWith("{")) {
    try {
      return sanitizeOverrides(JSON.parse(raw) as unknown, "environment");
    } catch (error) {
      loggingService.logWarn("Failed to parse VITE_EMERGENCY_KILL_SWITCHES JSON", { error }, "kill-switches");
      return {};
    }
  }

  return parseDelimitedOverrides(raw);
}

function createSnapshot(): EmergencyKillSwitchSnapshot {
  const defaults = createDefaultKillSwitches();
  const envOverrides = parseEnvironmentOverrides();
  const switches = {
    ...defaults,
    ...envOverrides,
    ...remoteOverrides,
    ...runtimeOverrides,
  } satisfies Record<EmergencyKillSwitchKey, boolean>;

  const sources: Partial<Record<EmergencyKillSwitchKey, EmergencyKillSwitchSource>> = {};
  for (const key of EMERGENCY_KILL_SWITCH_KEYS) {
    if (key in runtimeOverrides) {
      sources[key] = "runtime";
    } else if (key in remoteOverrides) {
      sources[key] = "remote";
    } else if (key in envOverrides) {
      sources[key] = "environment";
    } else {
      sources[key] = "defaults";
    }
  }

  return Object.freeze({
    switches: Object.freeze(switches),
    sources: Object.freeze(sources),
    updatedAt: new Date().toISOString(),
  });
}

function emitSnapshot(): EmergencyKillSwitchSnapshot {
  const snapshot = createSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }

  return snapshot;
}

export const emergencyKillSwitchService = {
  keys: EMERGENCY_KILL_SWITCH_KEYS,

  sanitizeOverrides,

  getDefaultSwitches(): EmergencyKillSwitches {
    return createDefaultKillSwitches();
  },

  getSnapshot(): EmergencyKillSwitchSnapshot {
    return createSnapshot();
  },

  getSwitches(): EmergencyKillSwitches {
    return createSnapshot().switches;
  },

  isActive(key: EmergencyKillSwitchKey): boolean {
    return createSnapshot().switches[key];
  },

  getActiveSwitches(): EmergencyKillSwitchKey[] {
    const snapshot = createSnapshot();
    return EMERGENCY_KILL_SWITCH_KEYS.filter((key) => snapshot.switches[key]);
  },

  getFeatureAvailability(key: FeatureFlagKey): KillSwitchFeatureAvailability {
    const flagAvailability = featureFlagService.getAvailability(key);
    if (!flagAvailability.enabled) {
      return flagAvailability;
    }

    const killSwitch = FEATURE_TO_KILL_SWITCH[key];
    if (killSwitch && this.isActive(killSwitch)) {
      return {
        key,
        enabled: false,
        reason: "This feature is temporarily unavailable while Picom operators resolve an issue.",
        killSwitch,
      };
    }

    return flagAvailability;
  },

  shouldShowEntryPoint(key: FeatureFlagKey): boolean {
    return this.getFeatureAvailability(key).enabled;
  },

  applyRemoteConfig(input: unknown): EmergencyKillSwitchSnapshot {
    remoteOverrides = sanitizeOverrides(input, "remote");
    return emitSnapshot();
  },

  clearRemoteConfig(): EmergencyKillSwitchSnapshot {
    remoteOverrides = {};
    return emitSnapshot();
  },

  setRuntimeOverride(key: EmergencyKillSwitchKey, enabled: boolean): EmergencyKillSwitchSnapshot {
    if (appConfig.environment === "production") {
      loggingService.logWarn("Runtime emergency kill switch override ignored in production", { key }, "kill-switches");
      return createSnapshot();
    }

    runtimeOverrides = {
      ...runtimeOverrides,
      [key]: enabled,
    };
    return emitSnapshot();
  },

  clearRuntimeOverrides(): EmergencyKillSwitchSnapshot {
    runtimeOverrides = {};
    return emitSnapshot();
  },

  subscribe(listener: EmergencyKillSwitchListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
