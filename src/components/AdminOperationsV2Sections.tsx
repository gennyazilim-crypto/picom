import { useCallback, useEffect, useState } from "react";
import { adminOperationsService, type AdminOperationsAccess } from "../services/adminOperationsService";
import type { AdminInfrastructureStatus, AdminOperationsListItem, AdminOperationsListSection, AdminSystemStatusV2 } from "../types/adminOperations";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import "./AdminOperationsV2Sections.css";

const sectionMeta: Record<AdminOperationsListSection, { title: string; description: string; icon: IconName }> = {
  users: { title: "Users overview", description: "Bounded metadata only; sensitive content is excluded.", icon: "users" },
  communities: { title: "Communities", description: "Safe community metadata without private channel or member payloads.", icon: "home" },
  reports: { title: "Reports", description: "Aggregate report metadata without descriptions or reporter identity.", icon: "bell" },
  abuse_events: { title: "Abuse events", description: "Redacted abuse signals for restricted review.", icon: "lock" },
};

function sectionTitle(section: AdminOperationsListSection): string {
  return sectionMeta[section]?.title ?? section.replace("_", " ");
}

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function presenceClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "online") return "is-online";
  if (normalized === "idle") return "is-idle";
  if (normalized === "dnd" || normalized === "busy") return "is-dnd";
  return "is-offline";
}

function presenceLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "dnd") return "Do not disturb";
  if (normalized === "busy") return "Busy";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AdminSystemStatusV2({ access }: { access: AdminOperationsAccess }) {
  const [status, setStatus] = useState<AdminSystemStatusV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (audit = false) => {
    setLoading(true);
    setError(null);
    const result = await adminOperationsService.getSystemStatusV2(access);
    if (result.ok) setStatus(result.data);
    else setError(result.message);
    setLoading(false);
    if (audit) await adminOperationsService.recordAction(access, "admin_snapshot_refreshed");
  };

  useEffect(() => { void load(); }, [access]);

  return (
    <section className="admin-ops-v2-section">
      <div className="admin-ops-v2-header">
        <div className="admin-ops-v2-header-copy">
          <strong><AppIcon name="settings" size="sm" /> Backend aggregate status</strong>
          <p>App-admin RPC; no private configuration is returned.</p>
        </div>
        <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={loading} onClick={() => void load(true)}>Refresh</button>
      </div>
      {error ? <div className="admin-ops-v2-error" role="alert">{error}</div> : null}
      {status ? (
        <>
          <div className="admin-ops-metrics">
            <article><span>Database</span><strong>{status.database}</strong></article>
            <article><span>Users</span><strong>{status.users}</strong></article>
            <article><span>Communities</span><strong>{status.communities}</strong></article>
            <article><span>Open reports</span><strong>{status.openReports}</strong></article>
            <article><span>Abuse events / 24h</span><strong>{status.abuseEvents24h}</strong></article>
            <article><span>Admin audit / 24h</span><strong>{status.adminAuditEvents24h}</strong></article>
          </div>
          <small className="admin-ops-v2-footnote">Checked {dateTimeService.formatFullTimestamp(status.checkedAt)} · {status.source}</small>
        </>
      ) : (
        <div className="admin-ops-v2-empty">
          <strong>Loading restricted status</strong>
          <p>Only safe aggregate counters are requested.</p>
        </div>
      )}
    </section>
  );
}

function statusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export function AdminInfrastructureHealth({ access }: { access: AdminOperationsAccess }) {
  const [status, setStatus] = useState<AdminInfrastructureStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (audit = false) => {
    setLoading(true);
    setError(null);
    const result = await adminOperationsService.getInfrastructureStatus(access);
    if (result.ok) setStatus(result.data); else setError(result.message);
    setLoading(false);
    if (audit) await adminOperationsService.recordAction(access, "admin_infrastructure_health_refreshed");
  }, [access]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  return (
    <section className="admin-ops-v2-section" aria-label="Protected infrastructure health">
      <div className="admin-ops-v2-header"><div className="admin-ops-v2-header-copy"><strong><AppIcon name="settings" size="sm" /> Production infrastructure</strong><p>Protected Edge probe. Credentials, host addresses, tokens, and room content are never returned.</p></div><button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={loading} onClick={() => void load(true)}>Refresh</button></div>
      {error ? <div className="admin-ops-v2-error" role="alert">{error}</div> : null}
      {status ? <><div className="admin-ops-metrics"><article><span>Overall</span><strong>{statusLabel(status.overall)}</strong></article><article><span>Deployment</span><strong>{statusLabel(status.deployment)}</strong></article><article><span>Database</span><strong>{statusLabel(status.database)}</strong></article><article><span>LiveKit</span><strong>{statusLabel(status.livekit)}</strong></article><article><span>TURN/TLS</span><strong>{statusLabel(status.turn)}</strong></article><article><span>Redis</span><strong>{statusLabel(status.redis)}</strong></article><article><span>LiveKit latency</span><strong>{status.livekitLatencyMs === null ? "Unavailable" : `${status.livekitLatencyMs} ms`}</strong></article></div><small className="admin-ops-v2-footnote">Checked {dateTimeService.formatFullTimestamp(status.checkedAt)} - {status.source}</small></> : <div className="admin-ops-v2-empty"><strong>Checking infrastructure</strong><p>The probe is restricted to Picom app administrators.</p></div>}
    </section>
  );
}

export function AdminOperationsPagedList({ access, section }: { access: AdminOperationsAccess; section: AdminOperationsListSection }) {
  const [items, setItems] = useState<readonly AdminOperationsListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const meta = sectionMeta[section];

  const load = async (nextCursor: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    const result = await adminOperationsService.listSection(section, access, nextCursor);
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
    void load(null, false);
  }, [access, section]);

  return (
    <section className={`admin-ops-v2-section admin-ops-v2-section--${section}`}>
      <div className="admin-ops-v2-header">
        <div className="admin-ops-v2-header-copy">
          <strong><AppIcon name={meta.icon} size="sm" /> {sectionTitle(section)}</strong>
          <p>{meta.description}</p>
        </div>
        <span className="admin-ops-v2-badge">25 per page</span>
      </div>

      {error ? <div className="admin-ops-v2-error" role="alert">{error}</div> : null}

      <div className="admin-ops-v2-list">
        {loading && !items.length ? (
          <div className="admin-ops-v2-empty">
            <strong>Loading records</strong>
            <p>Authorization is checked before safe metadata is returned.</p>
          </div>
        ) : items.length ? items.map((item) => (
          <article key={`${item.section}-${item.id}`} className="admin-ops-v2-card">
            {section === "users" ? (
              <span className="admin-ops-v2-avatar" aria-hidden="true">{initialsFromLabel(item.label)}</span>
            ) : (
              <span className="admin-ops-v2-icon" aria-hidden="true"><AppIcon name={meta.icon} size="sm" /></span>
            )}
            <div className="admin-ops-v2-card-copy">
              <strong>{item.label}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
            </div>
            <div className="admin-ops-v2-card-meta">
              <span className={`admin-ops-v2-status ${presenceClass(item.status)}`}>
                <i aria-hidden="true" />
                {presenceLabel(item.status)}
              </span>
              <time title={dateTimeService.formatFullTimestamp(item.createdAt)}>{dateTimeService.formatFullTimestamp(item.createdAt)}</time>
            </div>
          </article>
        )) : (
          <div className="admin-ops-v2-empty">
            <strong>No records</strong>
            <p>This restricted list has no safe records to show.</p>
          </div>
        )}
      </div>

      {hasMore ? (
        <button className="settings-inline-action settings-inline-action--ghost admin-ops-v2-load-more" type="button" disabled={loading || !cursor} onClick={() => void load(cursor, true)}>
          {loading ? "Loading..." : "Load more"}
        </button>
      ) : items.length ? (
        <small className="admin-ops-v2-footnote">End of restricted results.</small>
      ) : null}
    </section>
  );
}
