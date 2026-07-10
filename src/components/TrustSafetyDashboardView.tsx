import { useMemo } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { adminOperationsService } from "../services/adminOperationsService";
import { AppIcon } from "./AppIcon";

type TrustSafetyDashboardViewProps = Readonly<{
  access: AdminOperationsAccess;
}>;

export function TrustSafetyDashboardView({ access }: TrustSafetyDashboardViewProps) {
  const snapshot = useMemo(() => adminOperationsService.getSnapshot(), []);
  const allowed = access.allowed && (access.source === "development" || access.source === "app_admin");

  if (!allowed) {
    return null;
  }

  const abuse = snapshot.abuse.byType;

  return (
    <section className="trust-safety-dashboard-view" aria-label="Restricted Trust and Safety dashboard">
      <div className="admin-ops-detail">
        <strong><AppIcon name="lock" size="sm" /> Trust &amp; Safety signals</strong>
        <p>Aggregate local and placeholder counts only. Private messages, report descriptions, user identifiers, IP addresses, and secrets are excluded.</p>
      </div>
      <div className="admin-ops-metrics">
        <article><span>Open reports</span><strong>{snapshot.reports.open}</strong></article>
        <article><span>Recent bans</span><strong>0 placeholder</strong></article>
        <article><span>Recent kicks</span><strong>0 placeholder</strong></article>
        <article><span>Rate limit events</span><strong>{abuse.rate_limit_exceeded ?? 0}</strong></article>
        <article><span>Upload rejects</span><strong>{abuse.upload_rejected ?? 0}</strong></article>
        <article><span>Suspicious attachments</span><strong>{Math.max(abuse.suspicious_attachment ?? 0, snapshot.quarantine.quarantinedCount)}</strong></article>
        <article><span>Needs upload review</span><strong>{snapshot.quarantine.needsReviewCount}</strong></article>
        <article><span>Blocked word hits</span><strong>{abuse.blocked_words_hit ?? 0}</strong></article>
        <article><span>Failed login signals</span><strong>{abuse.repeated_failed_login ?? 0}</strong></article>
        <article><span>Critical signals</span><strong>{snapshot.abuse.critical}</strong></article>
        <article><span>Warning signals</span><strong>{snapshot.abuse.warning}</strong></article>
        <article><span>Total abuse events</span><strong>{snapshot.abuse.total}</strong></article>
      </div>
      <div className="admin-ops-detail">
        <strong>Backend status</strong>
        <p>Supabase: {snapshot.serviceHealth.supabase}. Storage review and moderation actions remain backend placeholders; this v1 dashboard performs no destructive or privileged mutation.</p>
      </div>
    </section>
  );
}

