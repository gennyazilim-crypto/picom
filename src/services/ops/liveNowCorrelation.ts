/**
 * Opaque correlation IDs for Live Now critical operations.
 * Never embed PII, emails, stream keys, or tokens.
 */

const CORRELATION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LiveNowCorrelationScope =
  | "publisher_application"
  | "stream_create"
  | "go_live"
  | "livekit_ingress"
  | "chat_moderation"
  | "analytics_finalize"
  | "recording_request"
  | "payment_flow"
  | "team_security"
  | "ops_probe";

export function createLiveNowCorrelationId(_scope?: LiveNowCorrelationScope): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for constrained runtimes — still opaque UUID-shaped.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isSafeLiveNowCorrelationId(value: unknown): value is string {
  return typeof value === "string" && CORRELATION_PATTERN.test(value);
}

export function sanitizeCorrelationId(value: unknown): string | null {
  return isSafeLiveNowCorrelationId(value) ? value : null;
}
