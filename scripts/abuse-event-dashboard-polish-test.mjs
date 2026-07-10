import { readFileSync } from "node:fs";

const dashboard = readFileSync("src/components/AbuseEventsDashboard.tsx", "utf8");
const panel = readFileSync("src/components/AdminOperationsPanel.tsx", "utf8");
const service = readFileSync("src/services/adminOperationsService.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260710198000_admin_operations_v2.sql", "utf8");
const source = readFileSync("supabase/migrations/20260710172000_trust_safety_dashboard_production.sql", "utf8");
const docs = readFileSync("docs/admin/abuse-event-dashboard.md", "utf8");

const checks = [
  [dashboard.includes('access.source === "app_admin"') && dashboard.includes("if (!allowed) return null"), "restricted render guard"],
  [dashboard.includes('listSection("abuse_events"') && dashboard.includes("Load more") && dashboard.includes("cursor"), "cursor pagination"],
  [dashboard.includes("Rate limits") && dashboard.includes("Upload rejects") && dashboard.includes("Unauthorized access"), "required filters"],
  [dashboard.includes("Severity") && dashboard.includes("critical") && dashboard.includes("warning"), "severity filter"],
  [dashboard.includes("No message text") && dashboard.includes("A signal is not proof of abuse"), "privacy-safe UI copy"],
  [panel.includes("AbuseEventsDashboard") && !panel.includes('<AdminOperationsPagedList access={access} section="abuse_events"'), "dedicated panel integration"],
  [service.includes("abuseEventService.getRecentEvents") && service.includes('rpc("list_admin_operations_v2"'), "service-only data path"],
  [migration.includes("if not public.is_app_admin()") && migration.includes("safe_limit") && migration.includes("reason_code detail"), "backend access/pagination/allowlist"],
  [source.includes("revoke all on public.abuse_events from anon, authenticated") && source.includes("Never store message content"), "source table protection"],
  [docs.includes("content-free") && docs.includes("25") && docs.includes("app-admin"), "dashboard documentation"],
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Abuse event dashboard polish failed: ${failed.join(", ")}`);
console.log("Restricted abuse filters, pagination, privacy copy, and backend allowlist contract passed.");
