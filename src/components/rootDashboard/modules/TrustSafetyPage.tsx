import { useEffect, useState } from "react";
import type { AdminOperationsAccess, TrustSafetySummary } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import { DashboardState } from "../components/DashboardState";
import { KpiCard } from "../components/KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

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

  if (loading) {
    return (
      <section className="rd-module" aria-label="Trust & Safety">
        <ModulePageHeader title="Trust & Safety" purpose="Aggregate safety backlogs — content bodies are never listed here." />
        <DashboardState tone="loading" title="Loading safety aggregates" />
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rd-module" aria-label="Trust & Safety">
        <ModulePageHeader title="Trust & Safety" purpose="Aggregate safety backlogs — content bodies are never listed here." />
        <DashboardState tone="error" detail={error ?? undefined} />
      </section>
    );
  }

  return (
    <section className="rd-module" aria-label="Trust & Safety">
      <ModulePageHeader
        title="Trust & Safety"
        purpose="Aggregate safety backlogs — content bodies are never listed here."
      />
      <div className="rd-kpi-strip" aria-label="Safety primary">
        <KpiCard label="Open reports" value={summary.openReports} variant={summary.openReports > 0 ? "warning" : "standard"} freshnessIso={summary.checkedAt} />
        <KpiCard label="Critical abuse" value={summary.criticalAbuseEvents} variant={summary.criticalAbuseEvents > 0 ? "warning" : "standard"} freshnessIso={summary.checkedAt} />
        <KpiCard label="Pending reviews" value={summary.pendingUploadReviews} freshnessIso={summary.checkedAt} />
      </div>
      <div className="rd-kpi-section">
        <header className="rd-kpi-section__head"><span>Backlog detail</span></header>
        <div className="rd-kpi-grid">
          <KpiCard label="Abuse events" value={summary.abuseEvents} freshnessIso={summary.checkedAt} />
          <KpiCard label="Suspicious uploads" value={summary.suspiciousUploads} freshnessIso={summary.checkedAt} />
          <KpiCard label="Rate limits" value={summary.rateLimitEvents} freshnessIso={summary.checkedAt} />
        </div>
      </div>
    </section>
  );
}
