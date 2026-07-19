import { useEffect, useState, type ReactNode } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import {
  rootDashboardOverviewService,
  type RootDashboardOverview,
} from "../../../services/rootDashboard/rootDashboardOverviewService";
import { DashboardChart } from "../DashboardChart";
import { DashboardState } from "../DashboardState";
import { KpiCard } from "../KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

type OverviewPageProps = Readonly<{ access: AdminOperationsAccess }>;

function unavailableCard(label: string, reason: string) {
  return <KpiCard label={label} value={null} unavailableReason={reason} />;
}

function KpiSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rd-kpi-section" aria-label={title}>
      <header className="rd-kpi-section__head">
        <span>{title}</span>
      </header>
      <div className="rd-kpi-grid">{children}</div>
    </section>
  );
}

export function OverviewPage({ access }: OverviewPageProps) {
  const [overview, setOverview] = useState<RootDashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void rootDashboardOverviewService.loadOverview(access).then((result) => {
      if (!active) return;
      setOverview(result);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Picom could not load the overview aggregates.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [access]);

  if (loading && !overview) {
    return (
      <DashboardState
        variant="loading"
        title="Loading overview"
        message="Collecting authorized product, system, and safety aggregates…"
      />
    );
  }

  if (error || !overview) {
    return <DashboardState variant="error" message={error ?? "Overview unavailable."} />;
  }

  const product = overview.productHealth;
  const system = overview.systemStatus;
  const trust = overview.trustSafety;
  const infra = overview.infrastructure;

  return (
    <section className="rd-module" aria-label="Overview">
      <ModulePageHeader
        title="Overview"
        purpose="Authorized platform health from live aggregates. Empty cards mean the contract is not deployed yet — never invented."
      />

      <div className="rd-kpi-strip" aria-label="Primary health">
        {product.available ? (
          <>
            <KpiCard label="API" value={product.data.apiStatus} freshnessIso={product.data.checkedAt} variant="realtime" />
            <KpiCard label="Realtime" value={product.data.realtimeStatus} />
            <KpiCard label="Voice" value={product.data.voiceStatus} />
            <KpiCard label="Errors" value={product.data.errorCount} variant={product.data.errorCount > 0 ? "warning" : "standard"} />
          </>
        ) : (
          unavailableCard("Product health", product.reason)
        )}
        {overview.onlineUsers.available ? (
          <KpiCard label="Online" value={overview.onlineUsers.data} freshnessIso={overview.loadedAt} variant="realtime" />
        ) : unavailableCard("Online users", overview.onlineUsers.reason)}
        {overview.currentIncidents.available ? (
          <KpiCard label="Incidents" value={overview.currentIncidents.data} variant={overview.currentIncidents.data > 0 ? "warning" : "standard"} />
        ) : unavailableCard("Incidents", overview.currentIncidents.reason)}
      </div>

      <div className="rd-split rd-overview-split">
        <KpiSection title="Product & system">
          {product.available ? (
            <>
              <KpiCard label="Warnings" value={product.data.warningCount} />
              <KpiCard label="Crash queue" value={product.data.crashReportCount} />
            </>
          ) : null}
          {system.available ? (
            <>
              <KpiCard label="Users" value={system.data.users} freshnessIso={system.data.checkedAt} />
              <KpiCard label="Communities" value={system.data.communities} />
              <KpiCard label="Open reports" value={system.data.openReports} variant={system.data.openReports > 0 ? "warning" : "standard"} />
              <KpiCard label="Abuse / 24h" value={system.data.abuseEvents24h} />
            </>
          ) : (
            unavailableCard("System status", system.reason)
          )}
          {infra.available ? (
            <>
              <KpiCard label="Infra" value={infra.data.overall.replace(/_/g, " ")} />
              <KpiCard label="Deployment" value={infra.data.deployment.replace(/_/g, " ")} />
              <KpiCard label="LiveKit" value={infra.data.livekit.replace(/_/g, " ")} />
            </>
          ) : (
            unavailableCard("Infrastructure", infra.reason)
          )}
        </KpiSection>

        <KpiSection title="Care & safety">
          {trust.available ? (
            <>
              <KpiCard label="T&S open" value={trust.data.openReports} />
              <KpiCard label="Suspicious uploads" value={trust.data.suspiciousUploads} />
              <KpiCard label="Critical abuse" value={trust.data.criticalAbuseEvents} variant={trust.data.criticalAbuseEvents > 0 ? "warning" : "standard"} />
            </>
          ) : (
            unavailableCard("Trust & Safety", trust.reason)
          )}
          {overview.supportBacklog.available ? (
            <KpiCard label="Support backlog" value={overview.supportBacklog.data} variant={overview.supportBacklog.data > 0 ? "warning" : "standard"} />
          ) : unavailableCard("Support backlog", overview.supportBacklog.reason)}
          {overview.moderationBacklog.available ? (
            <KpiCard label="Moderation backlog" value={overview.moderationBacklog.data} />
          ) : unavailableCard("Moderation backlog", overview.moderationBacklog.reason)}
          {overview.securityAlerts.available ? (
            <KpiCard label="Security alerts / 24h" value={overview.securityAlerts.data} variant={overview.securityAlerts.data > 0 ? "warning" : "standard"} />
          ) : unavailableCard("Security alerts", overview.securityAlerts.reason)}
          {overview.recentPrivilegedActions.available ? (
            <KpiCard label="Privileged actions / 24h" value={overview.recentPrivilegedActions.data} />
          ) : unavailableCard("Privileged actions", overview.recentPrivilegedActions.reason)}
        </KpiSection>
      </div>

      <KpiSection title="Engagement & growth">
        {overview.activeSessions.available ? (
          <KpiCard label="Active sessions" value={overview.activeSessions.data} />
        ) : unavailableCard("Active sessions", overview.activeSessions.reason)}
        {overview.activeVoiceRooms.available ? (
          <KpiCard label="Voice rooms" value={overview.activeVoiceRooms.data} />
        ) : unavailableCard("Active voice rooms", overview.activeVoiceRooms.reason)}
        {overview.registrations.available ? (
          <KpiCard label="Registrations / 24h" value={overview.registrations.data} />
        ) : unavailableCard("Registrations", overview.registrations.reason)}
        {overview.dau.available ? (
          <KpiCard label="DAU" value={overview.dau.data} />
        ) : unavailableCard("DAU", overview.dau.reason)}
        {overview.wau.available ? (
          <KpiCard label="WAU" value={overview.wau.data} />
        ) : unavailableCard("WAU", overview.wau.reason)}
        {overview.mau.available ? (
          <KpiCard label="MAU" value={overview.mau.data} />
        ) : unavailableCard("MAU", overview.mau.reason)}
        {overview.adPerformance.available ? (
          <>
            <KpiCard label="Ad impressions" value={overview.adPerformance.data.impressions} />
            <KpiCard label="Ad clicks" value={overview.adPerformance.data.clicks} />
          </>
        ) : unavailableCard("Ad performance", overview.adPerformance.reason)}
        {overview.subscriptionSnapshot.available ? (
          <>
            <KpiCard label="Active subscriptions" value={overview.subscriptionSnapshot.data.active} />
            <KpiCard label="MRR (cents)" value={overview.subscriptionSnapshot.data.mrrCents} />
          </>
        ) : unavailableCard("Subscriptions", overview.subscriptionSnapshot.reason)}
      </KpiSection>

      <DashboardChart
        title="Engagement trend"
        kind="line"
        series={[]}
        summary="DAU / WAU / MAU series require a warehouse contract."
        emptyMessage="Contract not deployed yet"
      />
    </section>
  );
}
