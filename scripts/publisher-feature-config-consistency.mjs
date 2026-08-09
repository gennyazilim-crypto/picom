import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guard = readFileSync(path.join(root, "src/services/ops/liveNowFeatureConfigGuard.ts"), "utf8");

assert.match(guard, /evaluateLiveNowFeatureConfigConsistency/);
assert.match(guard, /assertProductionPublisherFlagsFailClosed/);
assert.match(guard, /RECORDING_ON_WHILE_EGRESS_BLOCKED/);
assert.match(guard, /PAYOUT_ON_WITHOUT_PROVIDER/);
assert.match(guard, /MONETIZATION_ON_WITHOUT_PROVIDER/);

const flags = readFileSync(path.join(root, "src/services/featureFlagService.ts"), "utf8");
assert.match(flags, /enableCreatorStudio:\s*appConfig\.environment !== "production"/);
assert.match(flags, /enableGoLive:\s*appConfig\.environment !== "production"/);
assert.match(flags, /enablePublisherPayouts:\s*appConfig\.environment !== "production"/);

const sql = readFileSync(path.join(root, "supabase/migrations/20260808430000_live_now_production_ops.sql"), "utf8");
assert.match(sql, /evaluate_live_now_feature_config_consistency/);

console.log("publisher-feature-config-consistency: PASS");
