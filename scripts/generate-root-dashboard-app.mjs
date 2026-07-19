import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("src/components/rootDashboard/modules/UsersPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminOperationsListItem } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type UsersPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function UsersPage({ access }: UsersPageProps) {
  const [rows, setRows] = useState<AdminOperationsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminOperationsService.listSection("users", access).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setRows([]);
      } else {
        setRows(result.data.items);
        setError(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Users</h2>
          <p>Restricted admin user directory — no password or session secrets.</p>
        </div>
      </header>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No users returned for this admin list."
          columns={[
            { id: "label", header: "User", render: (row) => row.label },
            { id: "detail", header: "Handle", render: (row) => row.detail },
            { id: "status", header: "Status", render: (row) => row.status },
            { id: "createdAt", header: "Seen", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}
`);

w("src/components/rootDashboard/modules/CommunitiesPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminOperationsListItem } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type CommunitiesPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function CommunitiesPage({ access }: CommunitiesPageProps) {
  const [rows, setRows] = useState<AdminOperationsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminOperationsService.listSection("communities", access).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setRows([]);
      } else {
        setRows(result.data.items);
        setError(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Communities</h2>
          <p>Root community list with health/status cues when available.</p>
        </div>
      </header>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No communities returned for this admin list."
          columns={[
            { id: "label", header: "Community", render: (row) => row.label },
            { id: "detail", header: "Detail", render: (row) => row.detail },
            { id: "status", header: "Visibility", render: (row) => row.status },
            { id: "createdAt", header: "Seen", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}
`);

w("src/components/rootDashboard/modules/TrustSafetyPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess, TrustSafetySummary } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";

type TrustSafetyPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function TrustSafetyPage({ access }: TrustSafetyPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrustSafetySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminOperationsService.getTrustSafetySummary(access).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setSummary(null);
      } else {
        setSummary(result.data);
        setError(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  if (loading) return <DashboardState tone="loading" />;
  if (error || !summary) return <DashboardState tone="error" detail={error ?? undefined} />;

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Trust & Safety</h2>
          <p>Aggregate safety backlogs — content bodies are never listed here.</p>
        </div>
      </header>
      <div className="rd-kpi-grid">
        <KpiCard label="Open reports" value={summary.openReports} variant="warning" freshnessIso={summary.checkedAt} />
        <KpiCard label="Abuse events" value={summary.abuseEvents} freshnessIso={summary.checkedAt} />
        <KpiCard label="Critical abuse" value={summary.criticalAbuseEvents} variant="warning" freshnessIso={summary.checkedAt} />
        <KpiCard label="Suspicious uploads" value={summary.suspiciousUploads} freshnessIso={summary.checkedAt} />
        <KpiCard label="Pending upload reviews" value={summary.pendingUploadReviews} freshnessIso={summary.checkedAt} />
        <KpiCard label="Rate limits" value={summary.rateLimitEvents} freshnessIso={summary.checkedAt} />
      </div>
    </section>
  );
}
`);

w("src/components/rootDashboard/modules/SystemHealthPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminInfrastructureStatus, AdminSystemStatusV2 } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";

type SystemHealthPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SystemHealthPage({ access }: SystemHealthPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<AdminSystemStatusV2 | null>(null);
  const [infra, setInfra] = useState<AdminInfrastructureStatus | null>(null);
  const snapshot = adminOperationsService.getSnapshot();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      adminOperationsService.getSystemStatusV2(access),
      adminOperationsService.getInfrastructureStatus(access),
    ]).then(([systemResult, infraResult]) => {
      if (cancelled) return;
      if (!systemResult.ok && !infraResult.ok) {
        setError(systemResult.message || infraResult.message);
      } else {
        setError(null);
      }
      setSystem(systemResult.ok ? systemResult.data : null);
      setInfra(infraResult.ok ? infraResult.data : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  if (loading) return <DashboardState tone="loading" />;

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>System Health</h2>
          <p>Infrastructure and product health for root operators.</p>
        </div>
      </header>
      {error ? <DashboardState tone="error" detail={error} /> : null}
      <div className="rd-kpi-grid">
        <KpiCard label="API" value={snapshot.productHealth.apiStatus} variant="realtime" freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Realtime" value={snapshot.productHealth.realtimeStatus} variant="realtime" freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Voice / LiveKit" value={snapshot.productHealth.voiceStatus} freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Uploads" value={snapshot.productHealth.uploadStatus} freshnessIso={snapshot.productHealth.checkedAt} />
        <KpiCard label="Users (status v2)" value={system?.users ?? null} unavailableReason="System status RPC unavailable" freshnessIso={system?.checkedAt} />
        <KpiCard label="Communities (status v2)" value={system?.communities ?? null} unavailableReason="System status RPC unavailable" freshnessIso={system?.checkedAt} />
        <KpiCard label="Infra overall" value={infra?.overall ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
        <KpiCard label="Database" value={infra?.database ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
        <KpiCard label="LiveKit" value={infra?.livekit ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
        <KpiCard label="TURN" value={infra?.turn ?? null} unavailableReason="admin-health unavailable" freshnessIso={infra?.checkedAt} />
      </div>
    </section>
  );
}
`);

w("src/components/rootDashboard/modules/AuditLogPage.tsx", `import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminOperationsListItem } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type AuditLogPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AuditLogPage({ access }: AuditLogPageProps) {
  const [rows, setRows] = useState<AdminOperationsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const snapshot = adminOperationsService.getSnapshot();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Prefer abuse/report operational trails until dedicated audit list section exists.
    void adminOperationsService.listSection("reports", access).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setRows([]);
      } else {
        setRows(result.data.items);
        setError(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Audit Logs</h2>
          <p>Privileged operational trails. Recent client errors are shown only in redacted form.</p>
        </div>
      </header>
      <div className="rd-kpi-grid">
        <KpiCardLike label="Recent errors" value={snapshot.recentErrors.length} />
        <KpiCardLike label="Recent warnings" value={snapshot.recentWarnings.length} />
      </div>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No audit/report rows available."
          columns={[
            { id: "label", header: "Action", render: (row) => row.label },
            { id: "detail", header: "Detail", render: (row) => row.detail },
            { id: "status", header: "Status", render: (row) => row.status },
            { id: "createdAt", header: "When", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}

function KpiCardLike({ label, value }: { label: string; value: number }) {
  return (
    <article className="rd-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
`);

w("src/components/rootDashboard/modules/CommandCenterPage.tsx", `import { useMemo, useState } from "react";
import { flattenNavItems, type RootDashboardRouteKey } from "../navigation/rootDashboardNav";

type CommandCenterPageProps = Readonly<{
  onNavigate: (route: RootDashboardRouteKey) => void;
}>;

export function CommandCenterPage({ onNavigate }: CommandCenterPageProps) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const all = flattenNavItems();
    if (!normalized) return all;
    return all.filter((item) => item.label.toLowerCase().includes(normalized) || item.key.includes(normalized));
  }, [query]);

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Command Center</h2>
          <p>Jump to any Panel module. Same surface as the header search trigger.</p>
        </div>
      </header>
      <label className="rd-filter-bar" style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 6 }}>Find a module</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Users, voice, incidents…"
          style={{ width: "100%", height: 36 }}
        />
      </label>
      <div className="rd-nav-group__items">
        {items.map((item) => (
          <button key={item.key} type="button" className="rd-nav-item" onClick={() => onNavigate(item.key)}>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
`);

w("src/components/rootDashboard/modules/index.ts", `export { OverviewPage } from "./OverviewPage";
export { PlatformPage } from "./PlatformPage";
export { UsersPage } from "./UsersPage";
export { CommunitiesPage } from "./CommunitiesPage";
export { ContentPage } from "./ContentPage";
export { MessagingDmSafetyPage } from "./MessagingDmSafetyPage";
export { VoiceOpsPage } from "./VoiceOpsPage";
export { SupportCenterPage } from "./SupportCenterPage";
export { SupportTeamPage } from "./SupportTeamPage";
export { TrustSafetyPage } from "./TrustSafetyPage";
export { ModerationTeamPage } from "./ModerationTeamPage";
export { SecurityOpsPage } from "./SecurityOpsPage";
export { SecurityTeamPage } from "./SecurityTeamPage";
export { AdvertisingPage } from "./AdvertisingPage";
export { AdvertisingTeamPage } from "./AdvertisingTeamPage";
export { AdCreativeReviewPage } from "./AdCreativeReviewPage";
export { RevenuePage } from "./RevenuePage";
export { FinanceApprovalPage } from "./FinanceApprovalPage";
export { RadioOpsPage } from "./RadioOpsPage";
export { PodcastOpsPage } from "./PodcastOpsPage";
export { NotificationOpsPage } from "./NotificationOpsPage";
export { AnalyticsPage } from "./AnalyticsPage";
export { SystemHealthPage } from "./SystemHealthPage";
export { IncidentsPage } from "./IncidentsPage";
export { RolesPermissionsPage } from "./RolesPermissionsPage";
export { AuditLogPage } from "./AuditLogPage";
export { FeatureFlagsPage } from "./FeatureFlagsPage";
export { ReportsExportsPage } from "./ReportsExportsPage";
export { DashboardSettingsPage } from "./DashboardSettingsPage";
export { CommandCenterPage } from "./CommandCenterPage";
`);

w("src/components/rootDashboard/RootDashboardApp.tsx", `import { useEffect, useMemo, useState } from "react";
import { appConfig } from "../../config/appConfig";
import { useRootDashboardAccess } from "../../hooks/useRootDashboardAccess";
import { networkStatusService } from "../../services/networkStatusService";
import { DashboardState } from "./components/DashboardState";
import { GlobalFilterBar, defaultRootDashboardFilters, type RootDashboardFilters } from "./components/GlobalFilterBar";
import {
  AdvertisingPage,
  AdvertisingTeamPage,
  AdCreativeReviewPage,
  AnalyticsPage,
  AuditLogPage,
  CommandCenterPage,
  CommunitiesPage,
  ContentPage,
  DashboardSettingsPage,
  FeatureFlagsPage,
  FinanceApprovalPage,
  IncidentsPage,
  MessagingDmSafetyPage,
  ModerationTeamPage,
  NotificationOpsPage,
  OverviewPage,
  PlatformPage,
  PodcastOpsPage,
  RadioOpsPage,
  ReportsExportsPage,
  RevenuePage,
  RolesPermissionsPage,
  SecurityOpsPage,
  SecurityTeamPage,
  SupportCenterPage,
  SupportTeamPage,
  SystemHealthPage,
  TrustSafetyPage,
  UsersPage,
  VoiceOpsPage,
} from "./modules";
import type { RootDashboardRouteKey } from "./navigation/rootDashboardNav";
import { RootDashboardShell } from "./RootDashboardShell";
import "./rootDashboard.css";

type RootDashboardAppProps = Readonly<{
  currentUser: Readonly<{ displayName: string; username: string; email?: string }>;
  onExit: () => void;
}>;

export function RootDashboardApp({ currentUser, onExit }: RootDashboardAppProps) {
  const accessState = useRootDashboardAccess(true);
  const [route, setRoute] = useState<RootDashboardRouteKey>("overview");
  const [filters, setFilters] = useState<RootDashboardFilters>(defaultRootDashboardFilters);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "checking" | "reconnect">("checking");

  useEffect(() => {
    const snapshot = networkStatusService.getSnapshot();
    setConnectionStatus(snapshot.state === "online" ? "online" : snapshot.state === "offline" ? "offline" : "checking");
    return networkStatusService.subscribe((next) => {
      setConnectionStatus(next.state === "online" ? "online" : next.state === "offline" ? "offline" : "checking");
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setRoute("commandCenter");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const access = useMemo(() => ({
    allowed: accessState.allowed,
    source: accessState.source,
  }), [accessState.allowed, accessState.source]);

  if (accessState.status === "loading") {
    return <div className="root-dashboard" style={{ display: "grid", placeItems: "center" }}><DashboardState tone="loading" title="Checking Panel access" /></div>;
  }

  if (accessState.status === "denied" || !access.allowed) {
    return <div className="root-dashboard" style={{ display: "grid", placeItems: "center" }}><DashboardState tone="noPermission" onRetry={() => void accessState.refresh()} /></div>;
  }

  const page = (() => {
    switch (route) {
      case "overview": return <OverviewPage access={access} onNavigate={setRoute} />;
      case "platform": return <PlatformPage />;
      case "users": return <UsersPage access={access} />;
      case "communities": return <CommunitiesPage access={access} />;
      case "content": return <ContentPage />;
      case "messaging": return <MessagingDmSafetyPage />;
      case "voice": return <VoiceOpsPage />;
      case "support": return <SupportCenterPage />;
      case "supportTeam": return <SupportTeamPage />;
      case "trustSafety": return <TrustSafetyPage access={access} />;
      case "moderationTeam": return <ModerationTeamPage />;
      case "security": return <SecurityOpsPage />;
      case "securityTeam": return <SecurityTeamPage />;
      case "advertising": return <AdvertisingPage />;
      case "advertisingTeam": return <AdvertisingTeamPage />;
      case "adCreativeReview": return <AdCreativeReviewPage />;
      case "revenue": return <RevenuePage />;
      case "financeApproval": return <FinanceApprovalPage />;
      case "radio": return <RadioOpsPage />;
      case "podcast": return <PodcastOpsPage />;
      case "notifications": return <NotificationOpsPage />;
      case "analytics": return <AnalyticsPage />;
      case "systemHealth": return <SystemHealthPage access={access} />;
      case "incidents": return <IncidentsPage />;
      case "rolesPermissions": return <RolesPermissionsPage />;
      case "auditLogs": return <AuditLogPage access={access} />;
      case "featureFlags": return <FeatureFlagsPage />;
      case "reportsExports": return <ReportsExportsPage />;
      case "settings": return <DashboardSettingsPage />;
      case "commandCenter": return <CommandCenterPage onNavigate={setRoute} />;
      default: return <OverviewPage access={access} onNavigate={setRoute} />;
    }
  })();

  return (
    <RootDashboardShell
      currentUser={currentUser}
      activeRoute={route}
      onNavigate={setRoute}
      onExit={onExit}
      onOpenCommandCenter={() => setRoute("commandCenter")}
      connectionStatus={connectionStatus}
      environmentLabel={appConfig.releaseChannel}
      filterBar={<div style={{ padding: "10px 16px 0" }}><GlobalFilterBar value={filters} onChange={setFilters} onSaveView={() => undefined} /></div>}
    >
      {page}
    </RootDashboardShell>
  );
}
`);

console.log("wired modules + app ok");
