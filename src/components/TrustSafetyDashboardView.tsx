import { useEffect, useState } from "react";
import type { AdminOperationsAccess, TrustSafetySummary } from "../services/adminOperationsService";
import { adminOperationsService } from "../services/adminOperationsService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";

type TrustSafetyDashboardViewProps = Readonly<{ access: AdminOperationsAccess }>;
function displayCount(value: number | null): string { return value === null ? "Unavailable locally" : String(value); }

export function TrustSafetyDashboardView({ access }: TrustSafetyDashboardViewProps) {
  const allowed = access.allowed && (access.source === "development" || access.source === "app_admin");
  const [summary, setSummary] = useState<TrustSafetySummary | null>(() => allowed && access.source === "development" ? adminOperationsService.getLocalTrustSafetySummary() : null);
  const [loading, setLoading] = useState(allowed && access.source === "app_admin");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!allowed) { setSummary(null); setError(null); setLoading(false); return () => { active = false; }; }
    setLoading(true); setError(null);
    void adminOperationsService.getTrustSafetySummary(access).then((result) => {
      if (!active) return;
      if (result.ok) setSummary(result.data); else { setSummary(null); setError(result.message); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [access, allowed]);

  if (!allowed) return null;
  if (loading && !summary) return <div className="admin-ops-detail" role="status"><strong>Loading restricted safety summary</strong><p>Only aggregate, content-free counts are requested.</p></div>;
  if (error || !summary) return <div className="admin-ops-detail" role="alert"><strong>Safety summary unavailable</strong><p>{error ?? "No authorized summary was returned."}</p></div>;

  return (
    <section className="trust-safety-dashboard-view" aria-label="Restricted Trust and Safety dashboard">
      <div className="admin-ops-detail"><strong><AppIcon name="lock" size="sm" /> Trust &amp; Safety signals</strong><p>{summary.source === "app_admin_rpc" ? `Restricted ${summary.windowHours}-hour backend aggregates.` : "Development-only local aggregates."} Private messages, report descriptions, IDs, IP addresses, paths, reasons, and secrets are excluded.</p></div>
      <div className="admin-ops-metrics">
        <article><span>Open reports</span><strong>{summary.openReports}</strong></article>
        <article><span>Suspicious uploads</span><strong>{summary.suspiciousUploads}</strong></article>
        <article><span>Needs upload review</span><strong>{summary.pendingUploadReviews}</strong></article>
        <article><span>Abuse events</span><strong>{summary.abuseEvents}</strong></article>
        <article><span>Critical abuse events</span><strong>{summary.criticalAbuseEvents}</strong></article>
        <article><span>Rate limit events</span><strong>{summary.rateLimitEvents}</strong></article>
        <article><span>Recent bans</span><strong>{displayCount(summary.recentBans)}</strong></article>
        <article><span>Recent kicks</span><strong>{displayCount(summary.recentKicks)}</strong></article>
      </div>
      <div className="admin-ops-detail"><strong>Read-only aggregate view</strong><p>Checked {dateTimeService.formatFullTimestamp(summary.checkedAt)}. This dashboard performs no moderation, file review, account action, mutation, export, or destructive operation.</p></div>
    </section>
  );
}
