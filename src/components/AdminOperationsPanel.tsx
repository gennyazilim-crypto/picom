import { appConfig } from "../config/appConfig";
import { reportService } from "../services/reportService";
import { attachmentQuarantineService } from "../services/attachmentQuarantineService";
import { abuseEventService } from "../services/abuseEventService";

const adminSections = [
  {
    title: "System status",
    detail: "Local placeholder for app health, release channel, data source, and realtime status."
  },
  {
    title: "Users overview",
    detail: "Future restricted view for aggregate user counts only. No raw tokens or secrets."
  },
  {
    title: "Communities overview",
    detail: "Future restricted view for high-level community counts and operational status."
  },
  {
    title: "Reports",
    detail: "Future moderation report queue entry point for permitted operators."
  },
  {
    title: "Abuse and rate limits",
    detail: "Future summary for blocked attempts, rejected uploads, and suspicious events."
  },
  {
    title: "Upload storage",
    detail: "Future storage health placeholder for Supabase Storage and local test uploads."
  },
  {
    title: "Realtime status",
    detail: "Future Supabase Realtime and LiveKit operational summary."
  },
  {
    title: "Recent server errors",
    detail: "Future redacted error summary keyed by request ID where available."
  }
] as const;

export function AdminOperationsPanel() {
  const reportSummary = reportService.getSummary();
  const quarantineSummary = attachmentQuarantineService.getAdminSummaryPlaceholder();
  const quarantineRoutes = attachmentQuarantineService.getReviewRoutePlaceholders();
  const abuseSummary = abuseEventService.getAdminSummary();

  return (
    <section className="settings-status-card" aria-label="Admin operations placeholder">
      <span>Development only</span>
      <strong>Admin Operations placeholder</strong>
      <small>
        Hidden outside development builds. Production access must require app-admin authorization before this becomes a real operations panel.
      </small>
      <div className="security-card-grid">
        <article className="security-card">
          <span>Runtime</span>
          <strong>{appConfig.runtimeTarget}</strong>
          <small>{appConfig.name} {appConfig.releaseChannel} channel, {appConfig.dataSource} data source.</small>
        </article>
        <article className="security-card">
          <span>Security TODO</span>
          <strong>Admin auth required</strong>
          <small>Do not expose this panel to normal users or include secrets in responses.</small>
        </article>
        <article className="security-card">
          <span>Reports</span>
          <strong>{reportSummary.open} open</strong>
          <small>{reportSummary.reviewed} reviewed, {reportSummary.dismissed} dismissed, {reportSummary.action_taken} action taken.</small>
        </article>
        <article className="security-card">
          <span>Attachment quarantine</span>
          <strong>{quarantineSummary.quarantinedCount} blocked</strong>
          <small>{quarantineSummary.needsReviewCount} needing review. Routes prepared: {quarantineRoutes.list}; {quarantineRoutes.review}.</small>
        </article>
        <article className="security-card">
          <span>Abuse events</span>
          <strong>{abuseSummary.total} local</strong>
          <small>{abuseSummary.critical} critical, {abuseSummary.warning} warnings. Metadata is redacted and private content is not stored.</small>
        </article>
      </div>
      <div className="security-card-grid">
        {adminSections.map((section) => (
          <article className="security-card" key={section.title}>
            <span>Placeholder</span>
            <strong>{section.title}</strong>
            <small>{section.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
