// Task 02 — durable offline event queue with retry/backoff and a consent-gated,
// secret-free transport.
//
// - Consent: nothing is queued unless optional analytics is enabled.
// - Offline-first: envelopes persist in localStorage (capped, FIFO) and survive restarts.
// - Transport is OFF until VITE_ANALYTICS_SINK_URL (a public URL, never a secret) is set;
//   until then events stay on-device and are capped/dropped, never sent.
// - Retry: batched flush with exponential backoff; a failed batch is kept and retried.

import { analyticsService } from "../analyticsService";
import { ANALYTICS_SCHEMA_VERSION, buildEnvelope, type AnalyticsEnvelope, type AnalyticsEventName, type AnalyticsMetadata } from "./eventSchema";

const QUEUE_KEY = "picom.analytics.queue.v1";
const MAX_QUEUE = 500;
const BATCH_SIZE = 50;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const FLUSH_INTERVAL_MS = 60_000;

let backoffAttempt = 0;
let nextRetryAt = 0;
let flushInFlight = false;
let flushTimer: number | null = null;
let started = false;

function readQueue(): AnalyticsEnvelope[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as AnalyticsEnvelope[];
    return Array.isArray(parsed) ? parsed.filter((event) => event && event.schemaVersion === ANALYTICS_SCHEMA_VERSION) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: AnalyticsEnvelope[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
  } catch {
    /* storage full or unavailable; drop silently rather than throw in a tracking path */
  }
}

function getSinkUrl(): string | null {
  const raw = (import.meta.env.VITE_ANALYTICS_SINK_URL ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export const analyticsQueue = {
  // Enqueue a typed, validated event. No-op unless consent is granted.
  enqueue(name: AnalyticsEventName, metadata: AnalyticsMetadata = {}): AnalyticsEnvelope | null {
    if (!analyticsService.isEnabled()) return null;
    const envelope = buildEnvelope(name, metadata);
    if (!envelope) return null;
    writeQueue([...readQueue(), envelope]);
    void this.flush();
    return envelope;
  },

  pendingCount(): number {
    return readQueue().length;
  },

  clear(): void {
    try { window.localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
    backoffAttempt = 0;
    nextRetryAt = 0;
  },

  async flush(): Promise<{ sent: number; kept: number; reason?: string }> {
    if (flushInFlight) return { sent: 0, kept: this.pendingCount(), reason: "in-flight" };
    if (!analyticsService.isEnabled()) return { sent: 0, kept: 0, reason: "no-consent" };
    const sinkUrl = getSinkUrl();
    if (!sinkUrl) return { sent: 0, kept: this.pendingCount(), reason: "transport-disabled" };
    if (!isOnline()) return { sent: 0, kept: this.pendingCount(), reason: "offline" };
    if (Date.now() < nextRetryAt) return { sent: 0, kept: this.pendingCount(), reason: "backoff" };

    const queue = readQueue();
    if (queue.length === 0) return { sent: 0, kept: 0 };

    const batch = queue.slice(0, BATCH_SIZE);
    flushInFlight = true;
    try {
      const response = await fetch(sinkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: ANALYTICS_SCHEMA_VERSION, events: batch }),
        keepalive: true,
      });
      if (!response.ok) throw new Error(`sink status ${response.status}`);
      // Success: drop the batch, reset backoff, and continue if more remain.
      writeQueue(readQueue().slice(batch.length));
      backoffAttempt = 0;
      nextRetryAt = 0;
      const remaining = this.pendingCount();
      if (remaining > 0) void this.flush();
      return { sent: batch.length, kept: remaining };
    } catch (error) {
      backoffAttempt += 1;
      nextRetryAt = Date.now() + Math.min(BASE_BACKOFF_MS * 2 ** (backoffAttempt - 1), MAX_BACKOFF_MS);
      return { sent: 0, kept: this.pendingCount(), reason: error instanceof Error ? error.message : "flush-failed" };
    } finally {
      flushInFlight = false;
    }
  },

  // Wire background flushing: on regain-online, on visibility, and on an interval.
  start(): void {
    if (started || typeof window === "undefined") return;
    started = true;
    window.addEventListener("online", () => void this.flush());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void this.flush(); });
    flushTimer = window.setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    void this.flush();
  },

  stop(): void {
    if (flushTimer !== null) { window.clearInterval(flushTimer); flushTimer = null; }
    started = false;
  },
};
