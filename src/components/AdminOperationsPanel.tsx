import { appConfig } from "../config/appConfig";

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
