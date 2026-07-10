import { useCallback, useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { discoveryModerationService, type DiscoveryReviewItem, type DiscoveryReviewStatus } from "../services/discoveryModerationService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";

const statuses: DiscoveryReviewStatus[] = ["pending", "approved", "rejected", "hidden", "suspended"];

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
    const result = await discoveryModerationService.review(item.communityId, nextStatus, reasons[item.communityId] ?? "");
    if (!result.ok) return setNotice(result.message);
    setNotice(`${item.communityName} marked ${result.data}. Audit event recorded.`);
    await refresh();
  };

  return <section aria-label="Restricted discovery moderation queue"><div className="admin-ops-detail"><strong><AppIcon name="search" size="sm" /> Discovery review queue</strong><p>Safe public profile metadata and report counts only. Private communities, report descriptions, member data, messages, and attachments are excluded.</p><div className="settings-actions-row"><select value={filter ?? "all"} onChange={(event) => setFilter(event.target.value === "all" ? null : event.target.value as DiscoveryReviewStatus)}><option value="all">All states</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><button type="button" onClick={() => void refresh()}>Refresh</button></div></div>{notice ? <p className="bots-admin-notice" role="status">{notice}</p> : null}<div className="admin-ops-log-list">{loading ? <div className="admin-ops-detail"><strong>Loading queue</strong><p>Authorization is checked before safe metadata is returned.</p></div> : items.length ? items.map((item) => <article key={item.communityId}><div><strong>{item.communityName}</strong><span>{item.category} - {item.status} - {item.reportCount} reports - submitted {dateTimeService.formatFullTimestamp(item.submittedAt)}</span><small>{item.description}</small></div><div className="settings-actions-row"><select aria-label={`Review status for ${item.communityName}`} value={drafts[item.communityId] ?? item.status} onChange={(event) => setDrafts((current) => ({ ...current, [item.communityId]: event.target.value as DiscoveryReviewStatus }))}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><input aria-label={`Review note for ${item.communityName}`} value={reasons[item.communityId] ?? ""} maxLength={500} placeholder="Reason (recommended)" onChange={(event) => setReasons((current) => ({ ...current, [item.communityId]: event.target.value }))} /><button type="button" onClick={() => void applyReview(item)}>Apply</button></div></article>) : <div className="admin-ops-detail"><strong>No listings in this state</strong><p>Private and unlisted communities never enter this queue.</p></div>}</div></section>;
}

