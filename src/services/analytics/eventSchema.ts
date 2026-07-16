// Task 02 — typed, versioned analytics event schema.
//
// Privacy-first by construction: only allowlisted event names and per-event metadata
// keys are accepted, strings are length-capped, counts are clamped, and a SENSITIVE
// blocklist rejects anything content/identifier-shaped. Content (message/DM bodies,
// audio, video, attachments, query text) can never be represented here.
// See docs/intelligence/EVENT_SCHEMA.md and DATA_COLLECTION_POLICY.md.

export const ANALYTICS_SCHEMA_VERSION = 1 as const;

export type AnalyticsEventName =
  // lifecycle & session
  | "session_started"
  | "session_heartbeat"
  | "session_ended"
  // navigation
  | "view_opened"
  // downloads / installs
  | "download_started"
  | "download_completed"
  | "install_activated"
  // feed & community interactions
  | "feed_card_opened"
  | "community_opened"
  | "community_joined"
  | "community_created"
  | "message_activity_counted"
  // auth
  | "auth_succeeded"
  // media
  | "upload_completed"
  | "upload_failed"
  // voice & screen
  | "voice_joined"
  | "voice_join_failed"
  | "screen_share_started"
  // feature usage
  | "feature_used_counted"
  // search
  | "search_performed";

export type AnalyticsMetadata = Record<string, string | number | boolean>;

export type AnalyticsEnvelope = Readonly<{
  schemaVersion: typeof ANALYTICS_SCHEMA_VERSION;
  id: string;
  name: AnalyticsEventName;
  ts: string;
  metadata: AnalyticsMetadata;
}>;

// The ONLY metadata keys permitted per event. Everything else is dropped.
// Keys MUST NOT match SENSITIVE_KEY (below) or they are silently stripped — enforced by
// scripts/intelligence-event-taxonomy-validate.mjs. (This is why the release track is
// `releaseTrack`, not `releaseChannel`/`channel`, which collide with `channel`.)
const ALLOWED_METADATA: Record<AnalyticsEventName, readonly string[]> = {
  session_started: ["runtime", "releaseTrack"],
  session_heartbeat: ["durationBucket"],
  session_ended: ["durationBucket"],
  view_opened: ["view"],
  download_started: ["kind"],
  download_completed: ["kind", "sizeBucket"],
  install_activated: ["releaseTrack"],
  feed_card_opened: ["cardType", "dwellBucket"],
  community_opened: ["mode"],
  community_joined: ["mode"],
  community_created: ["mode"],
  message_activity_counted: ["count", "mode"],
  auth_succeeded: ["mode"],
  upload_completed: ["kind", "sizeBucket"],
  upload_failed: ["kind"],
  voice_joined: ["mode"],
  voice_join_failed: ["mode"],
  screen_share_started: ["mode"],
  feature_used_counted: ["feature", "count"],
  search_performed: ["resultBucket"],
};

// Allowlisted enum-like values (free strings are otherwise length-capped, never content).
const ALLOWED_VIEWS = new Set(["community", "directMessages", "feed", "discovery", "friends", "profile", "settings", "voice"]);
const SENSITIVE_KEY = /(message|body|text|query|password|token|secret|channel|attachment|email|username|user_id|session_id|authorization|ip|location)/i;

const MAX_STRING = 40;
const MAX_COUNT = 10_000;

export function isKnownEvent(name: string): name is AnalyticsEventName {
  return Object.prototype.hasOwnProperty.call(ALLOWED_METADATA, name);
}

function sanitizeValue(key: string, value: unknown): string | number | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 0), MAX_COUNT) : undefined;
  if (typeof value === "string") {
    if (key === "view" && !ALLOWED_VIEWS.has(value)) return undefined;
    return value.slice(0, MAX_STRING);
  }
  return undefined;
}

function sanitizeMetadata(name: AnalyticsEventName, metadata: AnalyticsMetadata): AnalyticsMetadata {
  const allowed = new Set(ALLOWED_METADATA[name]);
  const output: AnalyticsMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key) || SENSITIVE_KEY.test(key)) continue;
    const clean = sanitizeValue(key, value);
    if (clean !== undefined) output[key] = clean;
  }
  return output;
}

// Build a validated, versioned envelope. Returns null for unknown events so callers
// never emit an off-schema event.
export function buildEnvelope(name: string, metadata: AnalyticsMetadata = {}): AnalyticsEnvelope | null {
  if (!isKnownEvent(name)) return null;
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    id: `evt-${crypto.randomUUID()}`,
    name,
    ts: new Date().toISOString(),
    metadata: sanitizeMetadata(name, metadata),
  };
}

// Bucket helpers keep raw values off the wire.
export function durationBucket(ms: number): string {
  const min = ms / 60_000;
  if (min < 1) return "<1m";
  if (min < 5) return "1-5m";
  if (min < 30) return "5-30m";
  if (min < 120) return "30-120m";
  return ">120m";
}

export function sizeBucket(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return "<1MB";
  if (mb < 10) return "1-10MB";
  if (mb < 100) return "10-100MB";
  return ">100MB";
}

export function countBucket(count: number): string {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count < 5) return "2-4";
  if (count < 20) return "5-19";
  return "20+";
}
