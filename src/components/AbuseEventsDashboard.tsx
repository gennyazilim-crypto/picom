import { useEffect, useMemo, useState } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { adminOperationsService } from "../services/adminOperationsService";
import type { AdminOperationsListItem } from "../types/adminOperations";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import "../abuseEventsDashboard.css";

type SignalFilter = "all" | "rate_limit" | "upload" | "unauthorized";
type SeverityFilter = "all" | "info" | "warning" | "critical";

const signalFilters: ReadonlyArray<{ id: SignalFilter; label: string; icon: IconName }> = [
  { id: "all", label: "All signals", icon: "inbox" },
  { id: "rate_limit", label: "Rate limits", icon: "bell" },
  { id: "upload", label: "Upload rejects", icon: "image" },
  { id: "unauthorized", label: "Unauthorized access", icon: "lock" },
];

function classify(item: AdminOperationsListItem): Exclude<SignalFilter, "all"> | "other" {
  const value = `${item.label} ${item.detail}`.toLowerCase().replace(/_/g, " ");
  if (value.includes("rate limit") || value.includes("webhook rate")) return "rate_limit";
  if (value.includes("upload") || value.includes("attachment") || value.includes("suspicious")) return "upload";
  if (value.includes("unauthorized") || value.includes("private channel") || value.includes("invalid deep link")) return "unauthorized";
  return "other";
}

function eventIcon(item: AdminOperationsListItem): IconName {
  const category = classify(item);
  if (category === "upload") return "image";
  if (category === "unauthorized") return "lock";
  if (category === "rate_limit") return "bell";
  return "inbox";
}

export function AbuseEventsDashboard({ access }: { access: AdminOperationsAccess }) {
  const allowed = access.allowed && (access.source === "development" || access.source === "app_admin");
  const [items, setItems] = useState<readonly AdminOperationsListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const load = async (nextCursor: string | null, append: boolean) => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    const result = await adminOperationsService.listSection("abuse_events", access, nextCursor, 25);
    if (result.ok) {
      setItems((current) => append ? [...current, ...result.data.items] : result.data.items);
      setCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    if (!allowed) return;
    void load(null, false);
  }, [access, allowed]);

  const counts = useMemo(() => ({
    total: items.length,
    rateLimit: items.filter((item) => classify(item) === "rate_limit").length,
    uploads: items.filter((item) => classify(item) === "upload").length,
    unauthorized: items.filter((item) => classify(item) === "unauthorized").length,
  }), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const signalMatches = signalFilter === "all" || classify(item) === signalFilter;
    const severityMatches = severityFilter === "all" || item.status.toLowerCase() === severityFilter;
    return signalMatches && severityMatches;
  }), [items, severityFilter, signalFilter]);

  if (!allowed) return null;

  return (
    <section className="abuse-events-dashboard" aria-label="Restricted abuse event dashboard">
      <header className="abuse-events-heading">
        <div><strong>Abuse event signals</strong><span>Restricted, content-free operational metadata only.</span></div>
        <button type="button" disabled={loading} onClick={() => void load(null, false)}><AppIcon name="settings" size="sm" />{loading ? "Refreshing" : "Refresh"}</button>
      </header>

      <div className="admin-ops-metrics abuse-events-metrics" aria-label="Loaded abuse signal summary">
        <article><span>Loaded signals</span><strong>{counts.total}</strong></article>
        <article><span>Rate limits</span><strong>{counts.rateLimit}</strong></article>
        <article><span>Upload rejects</span><strong>{counts.uploads}</strong></article>
        <article><span>Unauthorized access</span><strong>{counts.unauthorized}</strong></article>
      </div>

      <div className="abuse-events-filters" aria-label="Abuse event filters">
        <div>{signalFilters.map((filter) => <button key={filter.id} type="button" className={signalFilter === filter.id ? "active" : ""} aria-pressed={signalFilter === filter.id} onClick={() => setSignalFilter(filter.id)}><AppIcon name={filter.icon} size="xs" />{filter.label}</button>)}</div>
        <label>Severity<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}><option value="all">All</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
      </div>

      <div className="admin-ops-detail abuse-events-privacy"><strong><AppIcon name="lock" size="sm" /> Privacy boundary</strong><p>No message text, report description, attachment content/path, user identity, raw IP, token, authorization header, cookie, or secret is loaded. A signal is not proof of abuse.</p></div>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}

      <div className="abuse-events-list" aria-live="polite">
        {filtered.map((item) => <article key={item.id}>
          <span className={`abuse-event-icon severity-${item.status.toLowerCase()}`}><AppIcon name={eventIcon(item)} size="sm" /></span>
          <div><strong>{item.label}</strong><span>Safe reason code: {item.detail || "not provided"}</span></div>
          <div><em>{item.status}</em><time>{dateTimeService.formatFullTimestamp(item.createdAt)}</time></div>
        </article>)}
        {!loading && !filtered.length ? <div className="admin-ops-detail"><strong>No matching signals</strong><p>Adjust the local filters or refresh this restricted page.</p></div> : null}
      </div>

      <footer>
        <span>{filtered.length} shown from {items.length} loaded. Backend pages are capped at 25.</span>
        {hasMore ? <button type="button" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>{loading ? "Loading" : "Load more"}</button> : items.length ? <em>End of results</em> : null}
      </footer>
    </section>
  );
}
