import { appConfig, type ReleaseChannel } from "../config/appConfig";
import { dataSourceService } from "./dataSourceService";
import { getApiCompatibilityRequestHeaders } from "../config/apiCompatibility";
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
const CACHE_SCHEMA_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 64 * 1024;
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

function toBoundedString(value: unknown, fallback: string, maximumLength = 240): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : fallback;
}

function toVersion(value: unknown, fallback: string): string {
  const candidate = toBoundedString(value, fallback, 64);
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(candidate) ? candidate : fallback;
}

function toPublicUrl(value: unknown, fallback: string): string {
  const candidate = toBoundedString(value, fallback, 2048);
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
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
    ? value.allowedMimeTypes.filter((item): item is string => typeof item === "string" && /^[a-z0-9.+-]{1,64}\/[a-z0-9.+-]{1,64}$/i.test(item)).slice(0, 16)
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
    minimumSupportedVersion: toVersion(input.minimumSupportedVersion, defaults.minimumSupportedVersion),
    recommendedClientVersion: toVersion(input.recommendedClientVersion, defaults.recommendedClientVersion),
    latestVersion: toVersion(input.latestVersion, defaults.latestVersion),
    releaseChannel: toReleaseChannel(input.releaseChannel, defaults.releaseChannel),
    featureFlags: Object.freeze(toFeatureFlags(input.featureFlags)),
    killSwitches: toKillSwitches(input.killSwitches),
    maintenance: Object.freeze({
      status: toMaintenanceStatus(maintenanceInput.status),
      message: toBoundedString(maintenanceInput.message, defaults.maintenance.message),
    }),
    uploadLimits: toUploadLimits(input.uploadLimits),
    urls: Object.freeze({
      statusPageUrl: toPublicUrl(urlsInput.statusPageUrl, defaults.urls.statusPageUrl),
      supportUrl: toPublicUrl(urlsInput.supportUrl, defaults.urls.supportUrl),
      docsUrl: toPublicUrl(urlsInput.docsUrl, defaults.urls.docsUrl),
    }),
    source,
    fetchedAt: new Date().toISOString(),
  });
}

function getRemoteConfigUrl(): string | null {
  let candidate = appConfig.remoteConfigUrl;

  if (!candidate) {
    const dataSource = dataSourceService.getStatus();
    if (!dataSource.isSupabase || !dataSource.configured) return null;
    const supabase = dataSourceService.getSupabaseConfig();
    candidate = `${supabase.url.replace(/\/+$/, "")}/functions/v1/client-config`;
  }

  try {
    const parsed = new URL(candidate);
    const isLocalHttp = parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname);
    return parsed.protocol === "https:" || isLocalHttp ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function getFetchHeaders(): HeadersInit {
  const supabase = dataSourceService.getSupabaseConfig();
  if (!supabase.anonKey) {
    return { Accept: "application/json", ...getApiCompatibilityRequestHeaders() };
  }

  return {
    Accept: "application/json",
    ...getApiCompatibilityRequestHeaders(),
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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, cachedAt: Date.now(), config }));
  } catch (error) {
    loggingService.logWarn("Failed to cache remote config", { error }, "remote-config");
  }
}

function readCachedConfig(): ClientRemoteConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (isPlainObject(parsed) && parsed.schemaVersion === CACHE_SCHEMA_VERSION && typeof parsed.cachedAt === "number") {
      if (!Number.isFinite(parsed.cachedAt) || Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS || !isPlainObject(parsed.config)) return null;
      return sanitizeRemoteConfig(parsed.config, "cache");
    }
    if (isPlainObject(parsed) && typeof parsed.fetchedAt === "string") {
      const legacyFetchedAt = Date.parse(parsed.fetchedAt);
      if (Number.isFinite(legacyFetchedAt) && Date.now() - legacyFetchedAt <= CACHE_MAX_AGE_MS) return sanitizeRemoteConfig(parsed, "cache");
    }
    return null;
  } catch (error) {
    loggingService.logWarn("Failed to read cached remote config", { error }, "remote-config");
    return null;
  }
}

async function readRemoteConfigResponse(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error("Remote config response exceeds the safe size limit");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("application/json")) throw new Error("Remote config response is not JSON");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error("Remote config response exceeds the safe size limit");
  return JSON.parse(text) as unknown;
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

      const body = await readRemoteConfigResponse(response);
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
