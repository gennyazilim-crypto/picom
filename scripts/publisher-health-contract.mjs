/**
 * TASK34: health contract — statuses must not collapse DISABLED/NOT_CONFIGURED into healthy boolean.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Dynamic import of TS via reading assertions on source (no ts-node in CI path).
const model = readFileSync(path.join(root, "src/services/ops/liveNowHealthModel.ts"), "utf8");
assert.match(model, /isOperationallyHealthy/);
assert.match(model, /status === "HEALTHY"/);
assert.doesNotMatch(model, /DISABLED.*HEALTHY|NOT_CONFIGURED.*true/);

const sql = readFileSync(path.join(root, "supabase/migrations/20260808430000_live_now_production_ops.sql"), "utf8");
assert.match(sql, /'DISABLED'/);
assert.match(sql, /'NOT_CONFIGURED'/);
assert.match(sql, /'BLOCKED'/);
assert.match(sql, /RECORDING_PIPELINE.*BLOCKED|status', 'BLOCKED'/);
assert.match(sql, /MONETIZATION.*NOT_CONFIGURED|status', 'NOT_CONFIGURED'/);
assert.match(sql, /check_kind in \('LIVENESS', 'READINESS', 'DEPENDENCY', 'AGGREGATE'\)/);

const opsService = readFileSync(path.join(root, "src/services/ops/liveNowOpsService.ts"), "utf8");
assert.match(opsService, /localStatusSummary/);
assert.match(opsService, /fetchProductionStatus/);
assert.match(opsService, /local_fallback/);

void require;
console.log("publisher-health-contract: PASS");
