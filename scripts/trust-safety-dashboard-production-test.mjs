import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const service = readFileSync(resolve(root, "src/services/adminOperationsService.ts"), "utf8");
const view = readFileSync(resolve(root, "src/components/TrustSafetyDashboardView.tsx"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260710172000_trust_safety_dashboard_production.sql"), "utf8");

for (const marker of ["getTrustSafetySummary", "access.source", "get_trust_safety_summary", "app_admin_rpc"]) assert.ok(service.includes(marker), `Missing restricted summary marker: ${marker}`);
for (const label of ["Open reports", "Suspicious uploads", "Abuse events", "Rate limit events", "Recent bans", "Recent kicks"]) assert.ok(view.includes(label), `Missing dashboard signal: ${label}`);
assert.ok(view.includes("if (!allowed) return null"), "Unauthorized dashboard must render nothing");
assert.ok(migration.includes("if not public.is_app_admin()"), "RPC must require app admin");
assert.ok(migration.includes("revoke all on public.abuse_events from anon, authenticated"), "Abuse rows must not be client-readable");
assert.ok(migration.includes("Returns no IDs, content, paths, reasons, credentials, IP data, or private message context"), "Aggregate privacy contract must be explicit");

console.log("Trust & Safety production dashboard contract tests passed.");
