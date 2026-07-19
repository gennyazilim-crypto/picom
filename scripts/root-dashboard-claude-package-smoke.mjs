import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, label) => {
  if (!condition) throw new Error(label);
  console.log(`OK ${label}`);
};

const requiredReports = [
  "docs/root-dashboard/ROOT_DASHBOARD_DISCOVERY_REPORT.md",
  "docs/root-dashboard/ROOT_DASHBOARD_SCOPE_LOCK.md",
  "docs/root-dashboard/ROOT_OWNER_BOOTSTRAP_REPORT.md",
  "docs/root-dashboard/RBAC_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_03_RBAC_REPORT.md",
  "docs/root-dashboard/TASK_04_PANEL_NAVIGATION_REPORT.md",
  "docs/root-dashboard/DASHBOARD_INFORMATION_ARCHITECTURE.md",
  "docs/root-dashboard/ANALYTICS_EVENT_SCHEMA.md",
  "docs/root-dashboard/TASK_06_ANALYTICS_FOUNDATION_REPORT.md",
  "docs/root-dashboard/TASK_07_REALTIME_METRICS_REPORT.md",
  "docs/root-dashboard/TASK_08_OVERVIEW_REPORT.md",
  "docs/root-dashboard/TASK_09_USER_MANAGEMENT_REPORT.md",
  "docs/root-dashboard/TASK_10_COMMUNITY_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_11_CONTENT_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_12_DM_SAFETY_REPORT.md",
  "docs/root-dashboard/TASK_13_VOICE_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_14_SUPPORT_CORE_REPORT.md",
  "docs/root-dashboard/SUPPORT_TEAM_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_15_SUPPORT_AUTH_REPORT.md",
  "docs/root-dashboard/TASK_16_SECURITY_OPERATIONS_REPORT.md",
  "docs/root-dashboard/SECURITY_TEAM_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_17_SECURITY_AUTH_REPORT.md",
  "docs/root-dashboard/TASK_18_TRUST_SAFETY_REPORT.md",
  "docs/root-dashboard/MODERATION_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_19_MODERATION_AUTH_REPORT.md",
  "docs/root-dashboard/TASK_20_ADVERTISING_SYSTEM_REPORT.md",
  "docs/root-dashboard/ADS_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_21_ADS_AUTH_REPORT.md",
  "docs/root-dashboard/TASK_22_AD_REVIEW_REPORT.md",
  "docs/root-dashboard/TASK_23_REVENUE_REPORT.md",
  "docs/root-dashboard/FINANCE_PERMISSION_MATRIX.md",
  "docs/root-dashboard/TASK_24_FINANCE_AUTH_REPORT.md",
  "docs/root-dashboard/TASK_25_RADIO_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_26_PODCAST_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_27_NOTIFICATION_OPERATIONS_REPORT.md",
  "docs/root-dashboard/TASK_28_SYSTEM_HEALTH_REPORT.md",
  "docs/root-dashboard/TASK_29_INCIDENT_MANAGEMENT_REPORT.md",
  "docs/root-dashboard/TASK_30_AUDIT_LOG_REPORT.md",
  "docs/root-dashboard/TASK_31_ROLE_MANAGEMENT_REPORT.md",
  "docs/root-dashboard/TASK_32_FEATURE_FLAGS_REPORT.md",
  "docs/root-dashboard/TASK_33_COMMAND_CENTER_REPORT.md",
  "docs/root-dashboard/TASK_34_REPORTING_REPORT.md",
  "docs/root-dashboard/TASK_35_REALTIME_REPORT.md",
  "docs/root-dashboard/TASK_36_PERFORMANCE_REPORT.md",
  "docs/root-dashboard/TASK_37_SECURITY_HARDENING_REPORT.md",
  "docs/root-dashboard/TASK_38_PRIVACY_COMPLIANCE_REPORT.md",
  "docs/root-dashboard/HOSTED_MULTI_ROLE_ACCEPTANCE_REPORT.md",
  "docs/root-dashboard/FINAL_ROOT_DASHBOARD_READINESS.md",
];

for (const path of requiredReports) {
  assert(existsSync(join(root, path)), `report exists: ${path}`);
}

assert(existsSync(join(root, "supabase/migrations/20260715140000_root_dashboard_operations_core.sql")), "core migration");
assert(existsSync(join(root, "supabase/migrations/20260715141000_root_dashboard_mutations_rbac_mfa.sql")), "mutations migration");
assert(existsSync(join(root, "supabase/tests/root_dashboard_multi_role_acceptance.sql")), "acceptance SQL");
assert(read("src/services/rootDashboard/rootDashboardMutationService.ts").includes("create_support_ticket"), "mutation service");
assert(read("src/services/rootDashboard/rootDashboardStepUp.ts").includes("STEP_UP_REQUIRED"), "step-up helper");
assert(read("src/services/rootDashboard/rootDashboardRealtimeService.ts").includes("root-dashboard-ops"), "realtime service");
assert(read("src/components/AdminOperationsPanelRedirect.tsx").includes("Open Panel"), "settings redirect");
assert(read("src/App.tsx").includes("onOpenPanel={openRootPanel}"), "App wires Panel from Settings");
assert(!read("src/components/rootDashboard/modules/VoiceOpsPage.tsx").includes("UnavailableModulePage"), "voice module wired");
assert(!read("src/components/rootDashboard/modules/RadioOpsPage.tsx").includes("UnavailableModulePage"), "radio module wired");
assert(!read("src/components/rootDashboard/modules/SupportCenterPage.tsx").includes("UnavailableModulePage"), "support module wired");

console.log(`OK root dashboard Claude package acceptance smoke (${requiredReports.length} reports)`);
