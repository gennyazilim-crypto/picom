import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import { rootDashboardOperationsService } from "../../../services/rootDashboard/rootDashboardOperationsService";
import type { AdminSystemStatusV2 } from "../../../types/adminOperations";
import type { RootDashboardOverviewMetrics } from "../../../types/rootDashboardOperations";
import { DashboardChart } from "../components/DashboardChart";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

type AnalyticsPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AnalyticsPage({ access }: AnalyticsPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<RootDashboardOverviewMetrics | null>(null);
  const [system, setSystem] = useState<AdminSystemStatusV2 | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      rootDashboardOperationsService.getOverviewMetrics(access),
      adminOperationsService.getSystemStatusV2(access),
    ]).then(([overviewResult, systemResult]) => {
      if (cancelled) return;
      if (!overviewResult.ok && !systemResult.ok) {
        setError(overviewResult.message || systemResult.message);
        setOverview(null);
        setSystem(null);
      } else {
        setError(null);
        setOverview(overviewResult.ok ? overviewResult.data : null);
        setSystem(systemResult.ok ? systemResult.data : null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access]);

  if (loading) return <DashboardState tone="loading" title="Loading analytics" />;

  return (
    <section className="rd-page">
      <ModulePageHeader
        title="Analytics"
        purpose="Product analytics from authorized overview metrics and system status. Warehouse series remain empty until contracted."
      />
      {error ? <DashboardState tone="error" detail={error} /> : null}
      <div className="rd-kpi-grid">
        <KpiCard label="Online users" value={overview?.onlineUsers ?? null} unavailableReason="Overview RPC unavailable" freshnessIso={overview?.checkedAt} />
        <KpiCard label="Active sessions" value={overview?.activeSessions ?? null} unavailableReason="Overview RPC unavailable" />
        <KpiCard label="DAU" value={overview?.analyticsAvailable ? overview.dau : null} unavailableReason={overview && !overview.analyticsAvailable ? "Analytics warehouse not deployed" : "Overview RPC unavailable"} />
        <KpiCard label="WAU" value={overview?.analyticsAvailable ? overview.wau : null} unavailableReason={overview && !overview.analyticsAvailable ? "Analytics warehouse not deployed" : "Overview RPC unavailable"} />
        <KpiCard label="MAU" value={overview?.analyticsAvailable ? overview.mau : null} unavailableReason={overview && !overview.analyticsAvailable ? "Analytics warehouse not deployed" : "Overview RPC unavailable"} />
        <KpiCard label="Registrations / 24h" value={overview?.registrations24h ?? null} unavailableReason="Overview RPC unavailable" />
        <KpiCard label="Users (system)" value={system?.users ?? null} unavailableReason="System status RPC unavailable" freshnessIso={system?.checkedAt} />
        <KpiCard label="Communities (system)" value={system?.communities ?? null} unavailableReason="System status RPC unavailable" />
        <KpiCard label="Open reports" value={system?.openReports ?? null} unavailableReason="System status RPC unavailable" />
        <KpiCard label="Abuse / 24h" value={system?.abuseEvents24h ?? null} unavailableReason="System status RPC unavailable" />
        <KpiCard label="Support backlog" value={overview?.supportBacklog ?? null} unavailableReason="Overview RPC unavailable" />
        <KpiCard label="Open incidents" value={overview?.openIncidents ?? null} unavailableReason="Overview RPC unavailable" />
      </div>
      <DashboardChart
        title="Product analytics"
        kind="bar"
        series={[]}
        summary="Time-series warehouse metrics require an approved analytics contract."
        emptyMessage="No warehouse series available"
      />
    </section>
  );
}
