import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const service = readFileSync(resolve(root, "src/services/reportService.ts"), "utf8");
const ui = readFileSync(resolve(root, "src/components/community/CommunityAdminSections.tsx"), "utf8");
const accessMigration = readFileSync(resolve(root, "supabase/migrations/20260710004800_mvp_plus_security_hardening.sql"), "utf8");
const workflowMigration = readFileSync(resolve(root, "supabase/migrations/20260710170000_reports_workflow_production.sql"), "utf8");

for (const marker of ["REPORT_SECRET_PATTERN", "canTransitionReportStatus", "if (!input.canReview)", "authorized content context", "directContext", "auditLogService.append"]) assert.ok(service.includes(marker), `Missing report service hardening marker: ${marker}`);
assert.ok(ui.includes('useState<import("../../types/reports").ReportRecord[]>([])'), "Moderator queue must start empty/fail closed");
assert.ok(ui.includes("canTransitionReportStatus"), "UI must follow transition contract");
assert.ok(accessMigration.includes("public.can_view_channel(message.channel_id)"), "Message reports must require visible channel");
assert.ok(accessMigration.includes("public.can_moderate_community_reports(community_id)"), "Moderator select/update must be community scoped");
assert.ok(workflowMigration.includes("reports_status_transition_guard"), "Database transition trigger is required");
assert.ok(workflowMigration.includes("terminal report states cannot be reopened"), "Terminal transition policy must be explicit");

console.log("Reports production workflow contract tests passed.");
