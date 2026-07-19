import { useCallback, useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { discoveryModerationService, type DiscoveryReviewItem, type DiscoveryReviewStatus } from "../services/discoveryModerationService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";
import "./DiscoveryReviewQueue.css";

const statuses: DiscoveryReviewStatus[] = ["pending", "approved", "rejected", "hidden", "suspended"];

function statusLabel(status: DiscoveryReviewStatus | "all"): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DiscoveryReviewQueue({ access }: { access: AdminOperationsAccess }) {
  const [filter, setFilter] = useState<DiscoveryReviewStatus | null>("pending");
  const [items, setItems] = useState<DiscoveryReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DiscoveryReviewStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const allowed = access.allowed && (access.source === "development" || access.source === "app_admin");

  const refresh = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    const result = await discoveryModerationService.listQueue(filter);
    setLoading(false);
    if (!result.ok) return setNotice(result.message);
    setItems(result.data);
    setDrafts(Object.fromEntries(result.data.map((item) => [item.communityId, item.status])));
  }, [allowed, filter]);

  useEffect(() => { void refresh(); }, [refresh]);
  if (!allowed) return null;

  const applyReview = async (item: DiscoveryReviewItem) => {
    const nextStatus = drafts[item.communityId] ?? item.status;
    if (nextStatus === "approved" && !item.category) {
      setNotice("A reviewed category is required before approval.");
      return;
    }
    const result = await discoveryModerationService.review(item.communityId, nextStatus, reasons[item.communityId] ?? "");
    if (!result.ok) return setNotice(result.message);
    setNotice(`${item.communityName} marked ${result.data}. Audit event recorded.`);
    await refresh();
  };

  return (
    <section className="discovery-review-queue" aria-label="Restricted discovery moderation queue">
      <div className="discovery-review-header">
        <div className="discovery-review-header-copy">
          <strong><AppIcon name="search" size="sm" /> Discovery review queue</strong>
          <p>Safe public profile metadata, content flags, and aggregate report counts only. Private communities, report descriptions, member data, messages, and attachments are excluded.</p>
        </div>
        <div className="discovery-review-toolbar">
          <select
            className="discovery-review-filter"
            value={filter ?? "all"}
            onChange={(event) => setFilter(event.target.value === "all" ? null : event.target.value as DiscoveryReviewStatus)}
            aria-label="Filter discovery review queue"
          >
            <option value="all">All states</option>
            {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {notice ? <p className="discovery-review-notice" role="status">{notice}</p> : null}

      <div className="discovery-review-list">
        {loading ? (
          <div className="discovery-review-empty">
            <strong>Loading queue</strong>
            <p>Authorization is checked before safe metadata is returned.</p>
          </div>
        ) : items.length ? items.map((item) => (
          <article key={item.communityId} className="discovery-review-card">
            <div className="discovery-review-card-head">
              <div className="discovery-review-card-title">
                <strong>{item.communityName}</strong>
                <span className={`discovery-review-badge discovery-review-badge--${item.status}`}>{statusLabel(item.status)}</span>
              </div>
              <div className="discovery-review-meta">
                <span>{item.category}</span>
                <span>{item.reportCount} report{item.reportCount === 1 ? "" : "s"}</span>
                <span>Submitted {dateTimeService.formatFullTimestamp(item.submittedAt)}</span>
              </div>
            </div>

            <p className="discovery-review-description">{item.description}</p>

            <div className="discovery-review-flags">
              {item.contentFlags.length
                ? item.contentFlags.map((flag) => <span key={flag} className="discovery-review-flag">{flag}</span>)
                : <span className="discovery-review-flag discovery-review-flag--muted">No content flags declared</span>}
            </div>

            <div className="discovery-review-actions">
              <label className="discovery-review-field">
                <span>Decision</span>
                <select
                  className="discovery-review-select"
                  aria-label={`Review status for ${item.communityName}`}
                  value={drafts[item.communityId] ?? item.status}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.communityId]: event.target.value as DiscoveryReviewStatus }))}
                >
                  {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </label>
              <label className="discovery-review-field discovery-review-field--grow">
                <span>Review note</span>
                <input
                  className="discovery-review-input"
                  aria-label={`Review note for ${item.communityName}`}
                  value={reasons[item.communityId] ?? ""}
                  maxLength={500}
                  placeholder="Reason (recommended)"
                  onChange={(event) => setReasons((current) => ({ ...current, [item.communityId]: event.target.value }))}
                />
              </label>
              <button type="button" className="settings-inline-action" onClick={() => void applyReview(item)}>Apply decision</button>
            </div>
          </article>
        )) : (
          <div className="discovery-review-empty">
            <strong>No listings in this state</strong>
            <p>Private and unlisted communities never enter this queue.</p>
          </div>
        )}
      </div>
    </section>
  );
}
