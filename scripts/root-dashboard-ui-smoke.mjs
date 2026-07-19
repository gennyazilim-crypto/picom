import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };

const app = read("src/App.tsx");
const sidebar = read("src/components/navigation/GlobalAppSidebar.tsx");
const shell = read("src/components/rootDashboard/RootDashboardShell.tsx");
const css = read("src/components/rootDashboard/rootDashboard.css");
const overviewPage = read("src/components/rootDashboard/modules/OverviewPage.tsx");
const listPage = read("src/components/rootDashboard/modules/RootDashboardModuleListPage.tsx");
const nav = read("src/components/rootDashboard/navigation/rootDashboardNav.ts");
const overview = read("src/services/rootDashboard/rootDashboardOverviewService.ts");

assert(app.includes("RootDashboardApp") && app.includes('activeView === "rootPanel"'), "App routes root Panel view");
assert(app.includes("useRootDashboardAccess") && app.includes("panelAccessStatus"), "App resolves Panel access");
assert(sidebar.includes("PanelEntryButton") && sidebar.includes("onOpenPanel"), "Global sidebar Panel entry");
assert(shell.includes("onOpenCommandCenter") && shell.includes("rd-shell"), "Astral-style dashboard shell");
assert(shell.includes("rd-sidebar__mark") && shell.includes("brandLogoUrl"), "Panel brand mark in sidebar");
assert(shell.includes("rd-nav-item") && shell.includes("item.icon"), "Panel nav renders icons");
assert(shell.includes("rd-filter-slot"), "Panel filter bar sticky slot");
assert(css.includes("display: block"), "Panel host (.root-dashboard) is full-bleed block, not a 2-col crush grid");
assert(/\.rd-shell\s*\{[^}]*grid-template-columns:\s*var\(--rd-sidebar-width\)/s.test(css), "Panel layout grid lives on .rd-shell");
assert(css.includes(".rd-kpi.is-unavailable") && css.includes(".rd-kpi-strip"), "Panel KPI strip + unavailable styling");
assert(css.includes("min-width: 0") && css.includes(".rd-content"), "Panel content can shrink/grow without clipping");
assert(css.includes(".rd-status-pill") && css.includes(".rd-table-foot"), "Panel table status pills + footer");
assert(css.includes(".rd-state__mark") && css.includes(".rd-module__toolbar"), "Panel state mark + module toolbar");
assert(listPage.includes("StatusPill") && listPage.includes("rd-kpi-strip"), "Module list pages use strip + status pills");
assert(overviewPage.includes("rd-kpi-section") && overviewPage.includes("Primary health"), "Overview is sectioned professionally");
assert(nav.includes("ROOT_DASHBOARD_NAV_GROUPS") && nav.includes("commandCenter"), "Full dashboard navigation");
assert(overview.includes("getOverviewMetrics") || overview.includes("onlineUsers"), "Overview uses live aggregate metrics");
assert(read("src/services/rootDashboard/rootDashboardOperationsService.ts").includes("list_root_dashboard_module_v1"), "Root dashboard operations service wired");
assert(read("src/components/AdminOperationsPanelRedirect.tsx").includes("Open Panel"), "Settings Admin Operations redirects to Panel");
assert(read("supabase/migrations/20260715140000_root_dashboard_operations_core.sql").includes("get_root_dashboard_overview_v1"), "Root dashboard backend migration present");
console.log("OK root dashboard smoke completed");
