import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("src/services/rootDashboard/rootDashboardOverviewService.ts", `import { adminOperationsService, type AdminOperationsAccess, type TrustSafetySummary } from "../adminOperationsService";
import type { AdminInfrastructureStatus } from "../../types/adminOperations";

export type OverviewMetric =
  | Readonly<{ available: true; value: number | string; freshAt: string }>
  | Readonly<{ available: false; reason: string }>;

export type RootDashboardOverview = Readonly<{
  checkedAt: string;
  productVersion: OverviewMetric;
  apiStatus: OverviewMetric;
  realtimeStatus: OverviewMetric;
  voiceStatus: OverviewMetric;
  openReports: OverviewMetric;
  abuseEvents: OverviewMetric;
  pendingUploadReviews: OverviewMetric;
  usersVisible: OverviewMetric;
  communitiesVisible: OverviewMetric;
  infrastructure: OverviewMetric;
  dau: OverviewMetric;
  supportBacklog: OverviewMetric;
  adPerformance: OverviewMetric;
  subscriptions: OverviewMetric;
  trustSafety: TrustSafetySummary | null;
  infrastructureStatus: AdminInfrastructureStatus | null;
}>;

function unavailable(reason: string): OverviewMetric {
  return { available: false, reason };
}

function available(value: number | string, freshAt: string): OverviewMetric {
  return { available: true, value, freshAt };
}

export const rootDashboardOverviewService = {
  async loadOverview(access: AdminOperationsAccess): Promise<RootDashboardOverview> {
    const checkedAt = new Date().toISOString();
    const snapshot = adminOperationsService.getSnapshot();
    const [trustResult, infraResult] = await Promise.all([
      adminOperationsService.getTrustSafetySummary(access),
      adminOperationsService.getInfrastructureStatus(access),
    ]);

    const trust = trustResult.ok ? trustResult.data : null;
    const infrastructureStatus = infraResult.ok ? infraResult.data : null;

    return {
      checkedAt,
      productVersion: available(snapshot.productHealth.version, snapshot.productHealth.checkedAt),
      apiStatus: available(snapshot.productHealth.apiStatus, snapshot.productHealth.checkedAt),
      realtimeStatus: available(snapshot.productHealth.realtimeStatus, snapshot.productHealth.checkedAt),
      voiceStatus: available(snapshot.productHealth.voiceStatus, snapshot.productHealth.checkedAt),
      usersVisible: available(snapshot.visibleUsers, checkedAt),
      communitiesVisible: available(snapshot.visibleCommunities, checkedAt),
      openReports: trust ? available(trust.openReports, trust.checkedAt) : unavailable(trustResult.ok ? "Unavailable" : trustResult.message),
      abuseEvents: trust ? available(trust.abuseEvents, trust.checkedAt) : unavailable(trustResult.ok ? "Unavailable" : trustResult.message),
      pendingUploadReviews: trust ? available(trust.pendingUploadReviews, trust.checkedAt) : unavailable("Upload review summary unavailable"),
      infrastructure: infrastructureStatus
        ? available(String(infrastructureStatus.overall), infrastructureStatus.checkedAt)
        : unavailable(infraResult.ok ? "Unavailable" : infraResult.message),
      dau: unavailable("Growth analytics contract not deployed yet"),
      supportBacklog: unavailable("Support center contract not deployed yet"),
      adPerformance: unavailable("Advertising analytics contract not deployed yet"),
      subscriptions: unavailable("Revenue/subscription contract not deployed yet"),
      trustSafety: trust,
      infrastructureStatus,
    };
  },
};
`);

w("src/components/rootDashboard/PanelEntryButton.tsx", `import { AppIcon } from "../AppIcon";

type PanelEntryButtonProps = Readonly<{
  compact?: boolean;
  active?: boolean;
  accessStatus: "loading" | "allowed" | "denied";
  onOpen: () => void;
}>;

export function PanelEntryButton({ compact = false, active = false, accessStatus, onOpen }: PanelEntryButtonProps) {
  if (accessStatus === "denied") return null;

  if (accessStatus === "loading") {
    return (
      <button type="button" className="rd-panel-entry is-loading" disabled aria-busy="true" aria-label="Checking Panel access" title="Checking Panel access">
        <AppIcon name="lock" size="sm" />
        {!compact ? <span>Panel</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={\`rd-panel-entry\${active ? " is-active" : ""}\`}
      aria-label="Open root operations Panel"
      title="Open root operations Panel"
      aria-current={active ? "page" : undefined}
      onClick={onOpen}
    >
      <AppIcon name="lock" size="sm" />
      {!compact ? <span>Panel</span> : null}
    </button>
  );
}
`);

w("src/components/rootDashboard/RootDashboardShell.tsx", `import { useMemo, useState, type ReactNode } from "react";
import { AppIcon } from "../AppIcon";
import { ROOT_DASHBOARD_NAV_GROUPS, routeLabel, type RootDashboardRouteKey } from "./navigation/rootDashboardNav";

type RootDashboardShellProps = Readonly<{
  currentUser: Readonly<{ displayName: string; username: string; email?: string }>;
  activeRoute: RootDashboardRouteKey;
  onNavigate: (route: RootDashboardRouteKey) => void;
  onExit: () => void;
  onOpenCommandCenter: () => void;
  connectionStatus: "online" | "offline" | "checking" | "reconnect";
  environmentLabel: string;
  filterBar?: ReactNode;
  children: ReactNode;
}>;

export function RootDashboardShell({
  currentUser,
  activeRoute,
  onNavigate,
  onExit,
  onOpenCommandCenter,
  connectionStatus,
  environmentLabel,
  filterBar,
  children,
}: RootDashboardShellProps) {
  const [compact, setCompact] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const crumb = useMemo(() => routeLabel(activeRoute), [activeRoute]);

  return (
    <div className={\`root-dashboard\${compact ? " is-compact" : ""}\`}>
      <aside className="rd-sidebar" aria-label="Root dashboard navigation">
        <div className="rd-sidebar__brand">
          <AppIcon name="lock" size="sm" />
          <div>
            <strong>Picom Panel</strong>
            <span>Root ops</span>
          </div>
        </div>
        <nav className="rd-sidebar__nav">
          {ROOT_DASHBOARD_NAV_GROUPS.map((group) => {
            const collapsed = collapsedGroups[group.id] === true;
            return (
              <div key={group.id} className="rd-nav-group">
                <button
                  type="button"
                  className="rd-nav-group__label"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: !collapsed }))}
                >
                  {group.label}
                  <AppIcon name={collapsed ? "chevronRight" : "chevronDown"} size="xs" />
                </button>
                {!collapsed ? (
                  <div className="rd-nav-group__items">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={\`rd-nav-item\${activeRoute === item.key ? " is-active" : ""}\`}
                        aria-current={activeRoute === item.key ? "page" : undefined}
                        title={item.label}
                        onClick={() => onNavigate(item.key)}
                      >
                        <AppIcon name={item.icon} size="sm" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: 10, displayTop: "1px solid var(--border)", display: "grid", gap: 8 }}>
          <button type="button" className="rd-nav-item" onClick={() => setCompact((value) => !value)} title="Toggle compact sidebar">
            <AppIcon name="more" size="sm" />
            <span>{compact ? "Expand" : "Compact"}</span>
          </button>
          <button type="button" className="rd-nav-item" onClick={onExit} title="Exit Panel">
            <AppIcon name="logout" size="sm" />
            <span>Exit Panel</span>
          </button>
        </div>
      </aside>

      <div className="rd-main">
        <header className="rd-header">
          <div className="rd-header__left">
            <div className="rd-breadcrumb" aria-label="Breadcrumb">
              <span>Panel</span>
              <AppIcon name="chevronRight" size="xs" />
              <strong>{crumb}</strong>
            </div>
          </div>
          <div className="rd-header__actions">
            <button type="button" className="rd-command-btn" onClick={onOpenCommandCenter} aria-label="Open command center">
              <AppIcon name="search" size="sm" />
              Search ops…
              <kbd>Ctrl K</kbd>
            </button>
            <span className="rd-chip" title="Environment">{environmentLabel}</span>
            <span className={\`rd-chip is-\${connectionStatus}\`} title="Realtime connection">
              <i aria-hidden="true" />
              {connectionStatus}
            </span>
            <span className="rd-chip" title={currentUser.email ?? currentUser.username}>
              <AppIcon name="user" size="xs" />
              {currentUser.displayName}
            </span>
          </div>
        </header>
        {filterBar}
        <div className="rd-content">{children}</div>
      </div>
    </div>
  );
}
`);

const unavailablePage = (name, title, purpose) => `import { DashboardState } from "../components/DashboardState";

export function ${name}() {
  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>${title}</h2>
          <p>${purpose}</p>
        </div>
      </header>
      <DashboardState
        tone="empty"
        title="Contract not available"
        detail="UI scaffold is ready. Live rows appear when the matching root-dashboard backend contract is deployed."
      />
    </section>
  );
}
`;

const modules = [
  ["PlatformPage", "Platform", "Product and platform controls for root operators."],
  ["ContentPage", "Content & Feed", "Search, review, and moderate feed content with evidence links."],
  ["MessagingDmSafetyPage", "DM Safety", "Privacy-preserving DM safety metadata and case-linked evidence."],
  ["VoiceOpsPage", "Voice operations", "LiveKit rooms, quality, TURN/STUN, and room controls."],
  ["SupportCenterPage", "Support Center", "Ticket queues, SLA risk, and three-pane case handling."],
  ["SupportTeamPage", "Support Team", "Staff roster, shifts, and escalation ownership."],
  ["SecurityOpsPage", "Security operations", "SOC alerts, auth risks, and privileged action review."],
  ["SecurityTeamPage", "Security Team", "Security staff access and on-call coverage."],
  ["ModerationTeamPage", "Moderation Team", "Moderator staffing and queue ownership."],
  ["AdvertisingPage", "Advertising", "Campaign performance and delivery health."],
  ["AdvertisingTeamPage", "Advertising Team", "Ad ops staffing and campaign ownership."],
  ["AdCreativeReviewPage", "Ad creative review", "Review, approve, or reject paid creatives."],
  ["RevenuePage", "Revenue & subscriptions", "Subscription snapshot and payout health."],
  ["FinanceApprovalPage", "Finance approval", "Approval queues for payouts and adjustments."],
  ["RadioOpsPage", "Radio operations", "Live radio sessions and schedule health."],
  ["PodcastOpsPage", "Podcast operations", "Catalog, releases, and processing status."],
  ["NotificationOpsPage", "Notification operations", "Push/email delivery and quiet-hour impact."],
  ["AnalyticsPage", "Analytics", "Growth and retention aggregates (k-suppressed)."],
  ["IncidentsPage", "Incidents", "Active incidents, severity, and mitigation timeline."],
  ["RolesPermissionsPage", "Roles & permissions", "Root capability matrix and grants."],
  ["FeatureFlagsPage", "Feature flags", "Flag state with environment targeting."],
  ["ReportsExportsPage", "Reports & exports", "Export jobs and scheduled report packs."],
  ["DashboardSettingsPage", "Dashboard settings", "Panel preferences for the current root account."],
];

for (const [name, title, purpose] of modules) {
  w(\`src/components/rootDashboard/modules/\${name}.tsx\`, unavailablePage(name, title, purpose));
}

w("src/components/rootDashboard/modules/OverviewPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardOverviewService, type RootDashboardOverview } from "../../../services/rootDashboard/rootDashboardOverviewService";
import { DashboardChart } from "../components/DashboardChart";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";
import type { RootDashboardRouteKey } from "../navigation/rootDashboardNav";

type OverviewPageProps = Readonly<{
  access: AdminOperationsAccess;
  onNavigate: (route: RootDashboardRouteKey) => void;
}>;

function metricProps(metric: RootDashboardOverview[keyof RootDashboardOverview]) {
  if (!metric || typeof metric !== "object" || !("available" in metric)) return { value: null as null, unavailableReason: "Unavailable" };
  if (metric.available) return { value: metric.value, freshnessIso: metric.freshAt };
  return { value: null as null, unavailableReason: metric.reason };
}

export function OverviewPage({ access, onNavigate }: OverviewPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<RootDashboardOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void rootDashboardOverviewService.loadOverview(access).then((data) => {
      if (cancelled) return;
      setOverview(data);
      setError(null);
      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Overview failed to load");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  if (loading) return <DashboardState tone="loading" />;
  if (error || !overview) return <DashboardState tone="error" detail={error ?? undefined} />;

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Overview</h2>
          <p>Executive ops strip — live health first, growth tiles only when contracts exist.</p>
        </div>
      </header>

      <div className="rd-kpi-grid">
        <KpiCard label="API" variant="realtime" definition="Backend reachability" {...metricProps(overview.apiStatus)} onDrillDown={() => onNavigate("systemHealth")} />
        <KpiCard label="Realtime" variant="realtime" {...metricProps(overview.realtimeStatus)} onDrillDown={() => onNavigate("systemHealth")} />
        <KpiCard label="Voice" {...metricProps(overview.voiceStatus)} onDrillDown={() => onNavigate("voice")} />
        <KpiCard label="Open reports" variant="warning" {...metricProps(overview.openReports)} onDrillDown={() => onNavigate("trustSafety")} />
        <KpiCard label="Abuse events" variant="warning" {...metricProps(overview.abuseEvents)} onDrillDown={() => onNavigate("trustSafety")} />
        <KpiCard label="Upload reviews" {...metricProps(overview.pendingUploadReviews)} onDrillDown={() => onNavigate("trustSafety")} />
        <KpiCard label="Users (visible)" {...metricProps(overview.usersVisible)} onDrillDown={() => onNavigate("users")} />
        <KpiCard label="Communities" {...metricProps(overview.communitiesVisible)} onDrillDown={() => onNavigate("communities")} />
        <KpiCard label="Infrastructure" {...metricProps(overview.infrastructure)} onDrillDown={() => onNavigate("systemHealth")} />
        <KpiCard label="DAU" {...metricProps(overview.dau)} onDrillDown={() => onNavigate("analytics")} />
        <KpiCard label="Support backlog" {...metricProps(overview.supportBacklog)} onDrillDown={() => onNavigate("support")} />
        <KpiCard label="Ad performance" {...metricProps(overview.adPerformance)} onDrillDown={() => onNavigate("advertising")} />
        <KpiCard label="Subscriptions" {...metricProps(overview.subscriptions)} onDrillDown={() => onNavigate("revenue")} />
        <KpiCard label="App version" variant="stale" {...metricProps(overview.productVersion)} />
      </div>

      <div className="rd-split">
        <DashboardChart
          title="Abuse & report signals"
          kind="bar"
          summary="Uses trust-safety counts when the summary RPC is available."
          series={overview.trustSafety ? [{
            label: "Safety",
            values: [overview.trustSafety.openReports, overview.trustSafety.abuseEvents, overview.trustSafety.pendingUploadReviews, overview.trustSafety.criticalAbuseEvents],
          }] : []}
          categories={["Reports", "Abuse", "Uploads", "Critical"]}
          emptyMessage="Trust & Safety summary unavailable"
        />
        <DashboardChart
          title="Voice quality proxies"
          kind="line"
          summary="Local diagnostics proxies — not fabricated DAU."
          series={[]}
          emptyMessage="Voice timeseries contract not deployed yet"
        />
      </div>
    </section>
  );
}
`);

console.log("shell+overview+stub modules ok");
