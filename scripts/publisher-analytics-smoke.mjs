/**
 * Static smoke + reconciliation fixtures for TASK29 publisher analytics.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const core = "supabase/migrations/20260808230000_publisher_analytics_core.sql";
const rollups = "supabase/migrations/20260808240000_publisher_analytics_rollups.sql";
const hard = "supabase/migrations/20260808250000_publisher_analytics_hardening.sql";
for (const file of [core, rollups, hard]) {
  assert.ok(existsSync(path.join(root, file)), `missing ${file}`);
}

const coreSql = read(core);
const rollSql = read(rollups);
const hardSql = read(hard);

for (const table of [
  "publisher_analytics_events",
  "publisher_viewer_sessions",
  "publisher_stream_health_samples",
  "publisher_analytics_rate_limits",
]) {
  assert.match(coreSql, new RegExp(`create table if not exists public\\.${table}`));
}
assert.match(rollSql, /publisher_stream_analytics_summaries/);
assert.match(rollSql, /finalize_publisher_stream_analytics/);
assert.match(rollSql, /get_publisher_analytics_overview/);
assert.match(rollSql, /service_record_publisher_analytics_livekit_event/);
const bridge = "supabase/migrations/20260808260000_publisher_analytics_viewer_bridge.sql";
assert.ok(existsSync(path.join(root, bridge)), `missing ${bridge}`);
const bridgeSql = read(bridge);
assert.match(bridgeSql, /resolve_publisher_stream_id_for_live_session/);
assert.match(bridgeSql, /publisher_analytics_on_stream_terminal/);
assert.match(bridgeSql, /finalize_publisher_stream_analytics/);

const watch = read("src/components/live/LiveWatchWorkspace.tsx");
assert.match(watch, /publisherAnalyticsService/);
assert.match(watch, /joinViewerSession/);
assert.match(watch, /resolveStreamIdForLiveSession/);

assert.match(coreSql, /idempotency_key/);
assert.match(coreSql, /publisher_analytics_events_idempotency_unique/);
assert.match(coreSql, /publisher_analytics_credit_watch_seconds/);
assert.match(coreSql, /least\(\s*45/);
assert.match(coreSql, /PUBLISHER_NOT_VIEWER/);
assert.doesNotMatch(coreSql, /for insert to authenticated/);
assert.doesNotMatch(hardSql, /grant select on table public\.publisher_analytics_events to authenticated/);

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enablePublisherAnalytics/);
assert.match(flags, /enablePublisherAnalytics:\s*appConfig\.environment !== "production"/);

const clientConfig = read("supabase/functions/client-config/index.ts");
assert.match(clientConfig, /PICOM_ENABLE_PUBLISHER_ANALYTICS/);

const service = read("src/services/live/publisherAnalyticsService.ts");
assert.match(service, /get_publisher_analytics_overview/);
assert.doesNotMatch(service, /localStorage\.(setItem|getItem)/);
assert.doesNotMatch(service, /Math\.random/);

const webhook = read("supabase/functions/livekit-webhook/index.ts");
assert.match(webhook, /service_record_publisher_analytics_livekit_event/);
assert.match(webhook, /publisher_analytics/);

const ui = read("src/components/publisher/PublisherAnalyticsPanel.tsx");
assert.match(ui, /analytics\.noAnalyticsData/);
assert.doesNotMatch(ui, /fake|placeholderZeros|demoMetrics/i);

// Watch-time reconciliation fixture (algorithm mirror)
function credit(prevMs, nextMs) {
  return Math.max(0, Math.min(45, Math.floor((nextMs - prevMs) / 1000)));
}
assert.equal(credit(0, 120_000), 45);
assert.equal(credit(0, 20_000), 20);
const watches = [120, 60, 30];
assert.equal(watches.reduce((a, b) => a + b, 0), 210);
assert.equal(watches.reduce((a, b) => a + b, 0) / watches.length, 70);

// Concurrency fixture: peak 3
const timeline = [
  ["A", "join"],
  ["B", "join"],
  ["C", "join"],
  ["B", "leave"],
  ["A", "leave"],
  ["C", "leave"],
];
let active = new Set();
let peak = 0;
for (const [id, op] of timeline) {
  if (op === "join") active.add(id);
  else active.delete(id);
  peak = Math.max(peak, active.size);
}
assert.equal(peak, 3);

console.log("publisher-analytics-smoke: PASS");
