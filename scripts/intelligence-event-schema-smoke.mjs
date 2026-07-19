import { readFileSync } from "node:fs";

// Task 02 contract test: the typed event schema and offline queue must stay
// privacy-first — closed union, allowlist + SENSITIVE blocklist, buckets over raw
// values, consent-gated queue, and a transport that is OFF and secret-free by default.

const read = (path) => readFileSync(path, "utf8");
const schema = read("src/services/analytics/eventSchema.ts");
const queue = read("src/services/analytics/analyticsQueue.ts");
const doc = read("docs/intelligence/EVENT_SCHEMA.md");

const checks = [
  [/ANALYTICS_SCHEMA_VERSION\s*=\s*1/.test(schema), "schema is versioned"],
  [schema.includes("export type AnalyticsEventName") && schema.includes("session_started") && schema.includes("search_performed"), "closed typed event union covers required families"],
  [schema.includes("if (!isKnownEvent(name)) return null"), "buildEnvelope rejects unknown/off-schema events"],
  [schema.includes("ALLOWED_METADATA") && schema.includes("const allowed = new Set(ALLOWED_METADATA[name])"), "per-event metadata allowlist enforced"],
  [/SENSITIVE_KEY\s*=\s*\/\(message\|body\|text\|query\|password\|token\|secret\|channel\|attachment\|email\|username\|user_id\|session_id\|authorization\|ip\|location\)/.test(schema), "SENSITIVE blocklist rejects content/identifier keys"],
  [schema.includes("slice(0, MAX_STRING)") && schema.includes("Math.min(Math.max(Math.trunc(value), 0), MAX_COUNT)"), "strings capped and counts clamped"],
  [schema.includes("durationBucket") && schema.includes("sizeBucket") && schema.includes("countBucket") && !schema.includes("search_performed: [\"query"), "buckets used; no raw query/duration/size on the wire"],

  [queue.includes("if (!analyticsService.isEnabled()) return null") && queue.includes('reason: "no-consent"'), "queue is consent-gated"],
  [queue.includes('import.meta.env.VITE_ANALYTICS_SINK_URL') && queue.includes('url.protocol === "https:"') && queue.includes('reason: "transport-disabled"'), "transport is OFF by default and HTTPS-only"],
  [queue.includes("MAX_QUEUE = 500") && queue.includes("slice(-MAX_QUEUE)"), "queue is durable and capped (FIFO)"],
  [queue.includes("backoffAttempt") && queue.includes("MAX_BACKOFF_MS") && queue.includes("nextRetryAt"), "batched flush uses exponential backoff"],
  [queue.includes('addEventListener("online"') && queue.includes("visibilitychange") && queue.includes("setInterval"), "background flush on online/visibility/interval"],
  [!/SERVICE_ROLE|API_SECRET|sk-[a-zA-Z0-9]/.test(schema) && !/SERVICE_ROLE|API_SECRET|sk-[a-zA-Z0-9]/.test(queue), "no provider secret referenced in the tracking layer"],

  [doc.includes("schemaVersion") && doc.includes("Transport is OFF by default") && doc.includes("SENSITIVE blocklist"), "schema doc documents versioning, gated transport, and blocklist"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Intelligence event schema contract passed.");
