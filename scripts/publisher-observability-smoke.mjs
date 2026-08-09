/**
 * TASK34 static smoke: observability contracts, health model, structured logging, kill switches.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migration = "supabase/migrations/20260808430000_live_now_production_ops.sql";
assert.ok(existsSync(path.join(root, migration)), migration);
const sql = read(migration);
assert.match(sql, /live_now_ops_metric_buckets/);
assert.match(sql, /live_now_ops_alert_states/);
assert.match(sql, /get_live_now_ops_status/);
assert.match(sql, /INSUFFICIENT_OBSERVATION_WINDOW|historical_blockers_preserved/);
assert.match(sql, /BLOCKED_INFRASTRUCTURE|NOT_CONFIGURED/);
assert.doesNotMatch(sql, /99\.9%/);

const healthModel = read("src/services/ops/liveNowHealthModel.ts");
for (const status of ["HEALTHY", "DEGRADED", "UNAVAILABLE", "DISABLED", "NOT_CONFIGURED", "UNKNOWN", "BLOCKED"]) {
  assert.match(healthModel, new RegExp(status));
}
assert.match(healthModel, /RECORDING_PIPELINE/);
assert.match(healthModel, /KYC_PAYOUT/);

const structured = read("src/services/ops/liveNowStructuredLog.ts");
assert.match(structured, /correlation_id/);
assert.match(structured, /severity/);
assert.match(structured, /emitLiveNowStructuredLog/);

const correlation = read("src/services/ops/liveNowCorrelation.ts");
assert.match(correlation, /createLiveNowCorrelationId/);
assert.match(correlation, /Never embed PII/);
assert.doesNotMatch(correlation, /user@|Bearer |eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./);

const edge = read("supabase/functions/live-now-ops-status/index.ts");
assert.match(edge, /get_live_now_ops_status/);
assert.match(edge, /REAL_TWO_DESKTOP_MEDIA_NOT_CERTIFIED/);
assert.match(edge, /media_canary:\s*"NOT_RUN"/);

const publicHealth = read("supabase/functions/health/index.ts");
assert.match(publicHealth, /no fake health|placeholders|UNKNOWN|evidence_note/i);

const kill = read("src/services/emergencyKillSwitchService.ts");
assert.match(kill, /disableGoLive/);
assert.match(kill, /disableLiveNowDiscovery/);
assert.match(kill, /disableCreatorStudio/);

const clientConfig = read("supabase/functions/client-config/index.ts");
assert.match(clientConfig, /PICOM_DISABLE_GO_LIVE/);
assert.match(clientConfig, /PICOM_DISABLE_LIVE_NOW_DISCOVERY/);

const catalog = read("src/services/localization/liveNowOpsCatalog.ts");
for (const locale of ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"]) {
  assert.match(catalog, new RegExp(`const ${locale}:`));
}
assert.match(catalog, /ops\.goLiveUnavailable/);

const goLive = read("src/components/live/GoLiveWorkspace.tsx");
assert.match(goLive, /disableGoLive|getFeatureAvailability\("enableGoLive"\)/);
assert.match(goLive, /emitLiveNowStructuredLog/);

console.log("publisher-observability-smoke: PASS");
