import { appConfig } from "../config/appConfig";
import { loggingService } from "./loggingService";

export const FEATURE_FLAG_KEYS = [
  "enableRealtime",
  "enableVoiceRooms",
  "enableDirectMessages",
  "enableFriends",
  "enableDiscovery",
  "enableBots",
  "enableWebhooks",
  "enableThreads",
  "enablePolls",
  "enableAdvancedModeration",
  "enableDiagnostics",
  "enableAutoUpdate",
  "enableAnalyticsPlaceholder",
  "enableDeveloperPortal",
  "enableCustomEmoji",
  "enableStickers",
  "enableForumChannels",
  "enableAnnouncementChannels",
  "enableSavedMessages",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;
export type FeatureFlagOverrides = Partial<Record<FeatureFlagKey, boolean>>;
export type FeatureFlagSource = "defaults" | "environment" | "remote";

export type FeatureFlagSnapshot = Readonly<{
  flags: FeatureFlags;
  sources: Partial<Record<FeatureFlagKey, FeatureFlagSource>>;
  updatedAt: string;
}>;

export type FeatureAvailability = Readonly<{
  key: FeatureFlagKey;
  enabled: boolean;
  reason?: string;
}>;

type FeatureFlagListener = (snapshot: FeatureFlagSnapshot) => void;

const keySet = new Set<string>(FEATURE_FLAG_KEYS);
const listeners = new Set<FeatureFlagListener>();
let remoteOverrides: FeatureFlagOverrides = {};
let runtimeOverrides: FeatureFlagOverrides = {};

function createDefaultFeatureFlags(): FeatureFlags {
  const developmentDiagnostics = appConfig.environment !== "production";

  return Object.freeze({
    enableRealtime: true,
    enableVoiceRooms: true,
    enableDirectMessages: false,
    enableFriends: false,
    enableDiscovery: true,
    enableBots: false,
    enableWebhooks: false,
    enableThreads: false,
    enablePolls: false,
    enableAdvancedModeration: false,
    enableDiagnostics: developmentDiagnostics,
    enableAutoUpdate: false,
    enableAnalyticsPlaceholder: false,
    enableDeveloperPortal: false,
    enableCustomEmoji: false,
    enableStickers: false,
    enableForumChannels: false,
    enableAnnouncementChannels: false,
    enableSavedMessages: true,
  });
}

function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return keySet.has(value);
}

function parseBooleanFlag(value: unknown): boolean | null {
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

function sanitizeOverrides(input: unknown, source: FeatureFlagSource): FeatureFlagOverrides {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const next: FeatureFlagOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isFeatureFlagKey(key)) {
      loggingService.logWarn("Ignoring unknown feature flag key", { key, source }, "feature-flags");
      continue;
    }

    const parsed = parseBooleanFlag(value);
    if (parsed === null) {
      loggingService.logWarn("Ignoring invalid feature flag value", { key, source }, "feature-flags");
      continue;
    }

    next[key] = parsed;
  }

  return next;
}

function parseDelimitedOverrides(raw: string): FeatureFlagOverrides {
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

function parseEnvironmentOverrides(): FeatureFlagOverrides {
  const rawValue = import.meta.env.VITE_FEATURE_FLAGS;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return {};
  }

  const raw = rawValue.trim();
  if (raw.startsWith("{")) {
    try {
      return sanitizeOverrides(JSON.parse(raw) as unknown, "environment");
    } catch (error) {
      loggingService.logWarn("Failed to parse VITE_FEATURE_FLAGS JSON", { error }, "feature-flags");
      return {};
    }
  }

  return parseDelimitedOverrides(raw);
}

function createSnapshot(): FeatureFlagSnapshot {
  const defaults = createDefaultFeatureFlags();
  const envOverrides = parseEnvironmentOverrides();
  const flags = {
    ...defaults,
    ...envOverrides,
    ...remoteOverrides,
    ...runtimeOverrides,
  } satisfies Record<FeatureFlagKey, boolean>;

  const sources: Partial<Record<FeatureFlagKey, FeatureFlagSource>> = {};
  for (const key of FEATURE_FLAG_KEYS) {
    if (key in runtimeOverrides || key in remoteOverrides) {
      sources[key] = "remote";
    } else if (key in envOverrides) {
      sources[key] = "environment";
    } else {
      sources[key] = "defaults";
    }
  }

  return Object.freeze({
    flags: Object.freeze(flags),
    sources: Object.freeze(sources),
    updatedAt: new Date().toISOString(),
  });
}

function emitSnapshot(): FeatureFlagSnapshot {
  const snapshot = createSnapshot();
  for (const listener of listeners) {
    listener(snapshot);
  }

  return snapshot;
}

export const featureFlagService = {
  keys: FEATURE_FLAG_KEYS,

  getDefaultFeatureFlags(): FeatureFlags {
    return createDefaultFeatureFlags();
  },

  getSnapshot(): FeatureFlagSnapshot {
    return createSnapshot();
  },

  getFlags(): FeatureFlags {
    return createSnapshot().flags;
  },

  isEnabled(key: FeatureFlagKey): boolean {
    return createSnapshot().flags[key];
  },

  getAvailability(key: FeatureFlagKey): FeatureAvailability {
    const enabled = this.isEnabled(key);
    return {
      key,
      enabled,
      reason: enabled ? undefined : "This feature is currently unavailable in this Picom build.",
    };
  },

  shouldShowEntryPoint(key: FeatureFlagKey): boolean {
    return this.isEnabled(key);
  },

  applyRemoteConfig(input: unknown): FeatureFlagSnapshot {
    remoteOverrides = sanitizeOverrides(input, "remote");
    return emitSnapshot();
  },

  clearRemoteConfig(): FeatureFlagSnapshot {
    remoteOverrides = {};
    return emitSnapshot();
  },

  setRuntimeOverride(key: FeatureFlagKey, enabled: boolean): FeatureFlagSnapshot {
    if (appConfig.environment === "production") {
      loggingService.logWarn("Runtime feature flag override ignored in production", { key }, "feature-flags");
      return createSnapshot();
    }

    runtimeOverrides = {
      ...runtimeOverrides,
      [key]: enabled,
    };
    return emitSnapshot();
  },

  clearRuntimeOverrides(): FeatureFlagSnapshot {
    runtimeOverrides = {};
    return emitSnapshot();
  },

  subscribe(listener: FeatureFlagListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
