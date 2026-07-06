import { appConfig, type ReleaseChannel } from "../config/appConfig";
import { dataSourceService } from "./dataSourceService";
import { emergencyKillSwitchService, type EmergencyKillSwitchOverrides } from "./emergencyKillSwitchService";
import { FEATURE_FLAG_KEYS, featureFlagService, type FeatureFlagOverrides } from "./featureFlagService";
import { loggingService } from "./loggingService";

export type RemoteConfigSource = "defaults" | "cache" | "remote";
export type RemoteMaintenanceStatus = "operational" | "degraded" | "maintenance";

export type RemoteUploadLimits = Readonly<{
  maxUploadBytes: number;
  allowedMimeTypes: readonly string[];
}>;

export type RemoteMaintenanceConfig = Readonly<{
  status: RemoteMaintenanceStatus;
  message: string;
}>;

export type RemoteSupportUrls = Readonly<{
  statusPageUrl: string;
  supportUrl: string;
  docsUrl: string;
}>;

export type ClientRemoteConfig = Readonly<{
  minimumSupportedVersion: string;
  recommendedClientVersion: string;
  latestVersion: string;
  releaseChannel: ReleaseChannel;
  featureFlags: FeatureFlagOverrides;
  killSwitches: EmergencyKillSwitchOverrides;
  maintenance: RemoteMaintenanceConfig;
  uploadLimits: RemoteUploadLimits;
  urls: RemoteSupportUrls;
  source: RemoteConfigSource;
  fetchedAt: string;
}>;

type RemoteConfigListener = (config: ClientRemoteConfig) => void;

type RefreshOptions = Readonly<{
  timeoutMs?: number;
}>;

const CACHE_KEY = "picom.remoteConfig.v1";
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const listeners = new Set<RemoteConfigListener>();
let currentConfig: ClientRemoteConfig = createDefaultRemoteConfig("defaults");

function createDefaultRemoteConfig(source: RemoteConfigSource): ClientRemoteConfig {
  return Object.freeze({
    minimumSupportedVersion: "0.1.0",
    recommendedClientVersion: appConfig.version,
    latestVersion: appConfig.version,
    releaseChannel: appConfig.releaseChannel,
    featureFlags: {},
    killSwitches: {},
    maintenance: Object.freeze({
      status: "operational",
      message: "Picom services are operating normally.",
    }),
    uploadLimits: Object.freeze({
      maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
      allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
    }),
    urls: Object.freeze({
      statusPageUrl: appConfig.statusPageUrl,
      supportUrl: "",
      docsUrl: "",
    }),
    source,
    fetchedAt: new Date().toISOString(),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function toReleaseChannel(value: unknown, fallback: ReleaseChannel): ReleaseChannel {
  return value === "dev" || value === "beta" || value === "stable" ? value : fallback;
}

function toMaintenanceStatus(value: unknown): RemoteMaintenanceStatus {
  return value === "maintenance" || value === "degraded" || value === "operational" ? value : "operational";
}

function toUploadLimits(value: unknown): RemoteUploadLimits {
  if (!isPlainObject(value)) {
    return createDefaultRemoteConfig("defaults").uploadLimits;
  }

  const maxUploadBytes = typeof value.maxUploadBytes === "number" && Number.isFinite(value.maxUploadBytes)
    ? Math.min(Math.max(value.maxUploadBytes, 1), 50 * 1024 * 1024)
    : DEFAULT_MAX_UPLOAD_BYTES;

  const allowedMimeTypes = Array.isArray(value.allowedMimeTypes)
    ? value.allowedMimeTypes.filter((item): item is string => typeof item === "string" && item.includes("/"))
    : [...DEFAULT_ALLOWED_MIME_TYPES];

  return Object.freeze({
    maxUploadBytes,
    allowedMimeTypes: Object.freeze(allowedMimeTypes.length > 0 ? allowedMimeTypes : [...DEFAULT_ALLOWED_MIME_TYPES]),
  });
}

function toFeatureFlags(value: unknown): FeatureFlagOverrides {
  if (!isPlainObject(value)) {
    return {};
  }

  const next: FeatureFlagOverrides = {};
  for (const key of FEATURE_FLAG_KEYS) {
    const remoteValue = value[key];
    if (typeof remoteValue === "boolean") {
      next[key] = remoteValue;
    }
  }

  return next;
}

function toKillSwitches(value: unknown): EmergencyKillSwitchOverrides {
  return Object.freeze(emergencyKillSwitchService.sanitizeOverrides(value, "remote"));
}

function sanitizeRemoteConfig(input: unknown, source: RemoteConfigSource): ClientRemoteConfig {
  const defaults = createDefaultRemoteConfig(source);
  if (!isPlainObject(input)) {
    return defaults;
  }

  const maintenanceInput = isPlainObject(input.maintenance) ? input.maintenance : {};
  const urlsInput = isPlainObject(input.urls) ? input.urls : {};

  return Object.freeze({
    minimumSupportedVersion: toStringValue(input.minimumSupportedVersion, defaults.minimumSupportedVersion),
    recommendedClientVersion: toStringValue(input.recommendedClientVersion, defaults.recommendedClientVersion),
    latestVersion: toStringValue(input.latestVersion, defaults.latestVersion),
    releaseChannel: toReleaseChannel(input.releaseChannel, defaults.releaseChannel),
    featureFlags: Object.freeze(toFeatureFlags(input.featureFlags)),
    killSwitches: toKillSwitches(input.killSwitches),
    maintenance: Object.freeze({
      status: toMaintenanceStatus(maintenanceInput.status),
      message: toStringValue(maintenanceInput.message, defaults.maintenance.message),
    }),
    uploadLimits: toUploadLimits(input.uploadLimits),
    urls: Object.freeze({
      statusPageUrl: toStringValue(urlsInput.statusPageUrl, defaults.urls.statusPageUrl),
      supportUrl: toStringValue(urlsInput.supportUrl, defaults.urls.supportUrl),
      docsUrl: toStringValue(urlsInput.docsUrl, defaults.urls.docsUrl),
    }),
    source,
    fetchedAt: new Date().toISOString(),
  });
}

function getRemoteConfigUrl(): string | null {
  if (appConfig.remoteConfigUrl) {
    return appConfig.remoteConfigUrl;
  }

  const dataSource = dataSourceService.getStatus();
  if (!dataSource.isSupabase || !dataSource.configured) {
    return null;
  }

  const supabase = dataSourceService.getSupabaseConfig();
  return `${supabase.url.replace(/\/+$/, "")}/functions/v1/client-config`;
}

function getFetchHeaders(): HeadersInit {
  const supabase = dataSourceService.getSupabaseConfig();
  if (!supabase.anonKey) {
    return { Accept: "application/json" };
  }

  return {
    Accept: "application/json",
    apikey: supabase.anonKey,
    Authorization: `Bearer ${supabase.anonKey}`,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: getFetchHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function persistCache(config: ClientRemoteConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch (error) {
    loggingService.logWarn("Failed to cache remote config", { error }, "remote-config");
  }
}

function readCachedConfig(): ClientRemoteConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return sanitizeRemoteConfig(JSON.parse(raw) as unknown, "cache");
  } catch (error) {
    loggingService.logWarn("Failed to read cached remote config", { error }, "remote-config");
    return null;
  }
}

function emit(config: ClientRemoteConfig): ClientRemoteConfig {
  currentConfig = config;
  featureFlagService.applyRemoteConfig(config.featureFlags);
  emergencyKillSwitchService.applyRemoteConfig(config.killSwitches);
  for (const listener of listeners) {
    listener(currentConfig);
  }

  return currentConfig;
}

export const remoteConfigService = {
  getDefaultConfig(): ClientRemoteConfig {
    return createDefaultRemoteConfig("defaults");
  },

  getSnapshot(): ClientRemoteConfig {
    return currentConfig;
  },

  getRemoteConfigUrl,

  subscribe(listener: RemoteConfigListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  applyConfig(input: unknown, source: RemoteConfigSource = "remote"): ClientRemoteConfig {
    const config = sanitizeRemoteConfig(input, source);
    if (source === "remote") {
      persistCache(config);
    }

    return emit(config);
  },

  loadCachedConfig(): ClientRemoteConfig {
    return emit(readCachedConfig() ?? createDefaultRemoteConfig("defaults"));
  },

  async refresh(options: RefreshOptions = {}): Promise<ClientRemoteConfig> {
    const url = getRemoteConfigUrl();
    if (!url) {
      return this.loadCachedConfig();
    }

    try {
      const response = await fetchWithTimeout(url, options.timeoutMs ?? 3500);
      if (!response.ok) {
        throw new Error(`Remote config request failed with ${response.status}`);
      }

      const body = await response.json().catch(() => ({}));
      return this.applyConfig(body, "remote");
    } catch (error) {
      loggingService.logWarn("Remote config refresh failed; using cached/default config", { error }, "remote-config");
      return this.loadCachedConfig();
    }
  },

  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      loggingService.logWarn("Failed to clear remote config cache", { error }, "remote-config");
    }
  },
};
