export const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_QUERY_KEYS)[number];
export type Attribution = Readonly<Partial<Record<AttributionKey, string>>>;
export type AttributionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type AttributionOptions = Readonly<{ storage?: AttributionStorage; now?: number }>;

const STORAGE_KEY = "picom.marketing.attribution.v1";
const MAX_VALUE_LENGTH = 160;
export const ATTRIBUTION_TTL_MS = 30 * 60 * 1000;

type StoredAttribution = Readonly<{
  version: 1;
  capturedAt: number;
  values: Attribution;
}>;

function emptyAttribution(): Attribution {
  return Object.freeze({});
}

function resolveStorage(options: AttributionOptions): AttributionStorage | undefined {
  if (options.storage) return options.storage;
  return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
}

function resolveNow(options: AttributionOptions): number {
  return typeof options.now === "number" && Number.isFinite(options.now) ? options.now : Date.now();
}

function isSafeAttributionValue(value: string): boolean {
  return Boolean(value)
    && value.length <= MAX_VALUE_LENGTH
    && !/[\u0000-\u001F\u007F]/.test(value)
    && /^[A-Za-z0-9._~-]+$/.test(value)
    // Never persist obvious email-shaped campaign values. Attribution is not sent
    // to client analytics either, but this avoids retaining accidental PII.
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseAttribution(search: string): Attribution {
  const values: Partial<Record<AttributionKey, string>> = {};
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = (params.get(key) ?? "").trim();
    if (isSafeAttributionValue(value)) values[key] = value;
  }
  return Object.freeze(values);
}

function normalizeStoredAttribution(value: unknown): Attribution {
  if (!value || typeof value !== "object") return emptyAttribution();
  const parsed = value as Partial<StoredAttribution>;
  const normalized = new URLSearchParams();
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const candidate = parsed.values?.[key];
    if (typeof candidate === "string") normalized.set(key, candidate);
  }
  return parseAttribution(normalized.toString());
}

function readStoredAttribution(options: AttributionOptions = {}): Attribution {
  const storage = resolveStorage(options);
  if (!storage) return emptyAttribution();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyAttribution();
    const parsed = JSON.parse(raw) as Partial<StoredAttribution>;
    const now = resolveNow(options);
    const capturedAt = parsed.capturedAt;
    if (
      parsed.version !== 1
      || typeof capturedAt !== "number"
      || !Number.isFinite(capturedAt)
      || capturedAt > now
      || now - capturedAt >= ATTRIBUTION_TTL_MS
    ) {
      storage.removeItem(STORAGE_KEY);
      return emptyAttribution();
    }
    return normalizeStoredAttribution(parsed);
  } catch {
    return emptyAttribution();
  }
}

/** Store only an allowlisted, bounded first-touch attribution record for this tab. */
export function captureAttributionFromLocation(
  search = typeof window === "undefined" ? "" : window.location.search,
  options: AttributionOptions = {},
): Attribution {
  const captured = parseAttribution(search);
  if (Object.keys(captured).length === 0) return readStoredAttribution(options);
  const storage = resolveStorage(options);
  if (!storage) return captured;
  try {
    const record: StoredAttribution = {
      version: 1,
      capturedAt: resolveNow(options),
      values: captured,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private browsing or disabled storage must not break sign-up.
  }
  return captured;
}

/**
 * Preserve sanitized campaign and Google click identifiers when Picom Web hands
 * registration off to Account Center. No attribution value is ever used as an
 * analytics event payload by this repository.
 */
export function appendAttributionToUrl(url: string, attribution: Attribution = readStoredAttribution()): string {
  try {
    const target = new URL(url);
    for (const key of ATTRIBUTION_QUERY_KEYS) {
      const value = attribution[key];
      if (value) target.searchParams.set(key, value);
    }
    return target.toString();
  } catch {
    return url;
  }
}
