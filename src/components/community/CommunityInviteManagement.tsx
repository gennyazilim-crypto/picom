import { useEffect, useMemo, useState } from "react";
import type { Community } from "../../types/community";
import {
  communityInviteService,
  type CommunityInviteLifecycleStatus,
  type InviteCampaignSummary,
} from "../../services/community/communityInviteService";
import { dateTimeService } from "../../services/dateTimeService";
import { AppIcon } from "../AppIcon";
import "./CommunityInviteManagement.css";

type Filter = "all" | CommunityInviteLifecycleStatus;
type Props = Readonly<{ community: Community; canCreate: boolean; onOpenInvite: () => void }>;

const filters: readonly Filter[] = ["all", "active", "revoked", "expired", "exhausted"];

function labelForStatus(status: CommunityInviteLifecycleStatus): string {
  return status === "exhausted" ? "Use limit reached" : status[0].toUpperCase() + status.slice(1);
}

function statusIcon(status: CommunityInviteLifecycleStatus): "send" | "trash" | "inbox" {
  if (status === "active") return "send";
  if (status === "revoked") return "trash";
  return "inbox";
}

export function CommunityInviteManagement({ community, canCreate, onOpenInvite }: Props) {
  const [campaigns, setCampaigns] = useState<InviteCampaignSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<InviteCampaignSummary | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotice(null);
    void communityInviteService.listInviteCampaigns(community.id).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.ok) setCampaigns(result.data);
      else setNotice({ error: true, text: result.error.message });
    });
    return () => {
      active = false;
    };
  }, [community.id]);

  const counts = useMemo(
    () =>
      campaigns.reduce<Record<CommunityInviteLifecycleStatus, number>>(
        (summary, campaign) => {
          summary[communityInviteService.getLifecycleStatus(campaign)] += 1;
          return summary;
        },
        { active: 0, expired: 0, revoked: 0, exhausted: 0 },
      ),
    [campaigns],
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? campaigns
        : campaigns.filter((campaign) => communityInviteService.getLifecycleStatus(campaign) === filter),
    [campaigns, filter],
  );

  const revoke = async () => {
    if (!pendingRevoke || busyId) return;
    const target = pendingRevoke;
    setBusyId(target.id);
    setNotice(null);
    const result = await communityInviteService.revokeInvite(target.id);
    setBusyId(null);
    setPendingRevoke(null);
    if (!result.ok) {
      setNotice({ error: true, text: result.error.message });
      return;
    }
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === target.id ? { ...campaign, revokedAt: result.data.revokedAt } : campaign,
      ),
    );
    setNotice({ error: false, text: `${target.campaignLabel ?? "Invite"} revoked.` });
  };

  const emptyLabel = filter === "all" ? "invite campaigns" : `${filter} invites`;

  return (
    <div className="community-invite-management">
      <div className="community-mgmt-card invite-summary-card">
        <div className="invite-summary-copy">
          <strong>{campaigns.length} invite campaigns</strong>
          <span>Aggregate usage only. Invite codes are never exposed in this list.</span>
        </div>
        <button type="button" className="community-mgmt-action" disabled={!canCreate} onClick={onOpenInvite}>
          <AppIcon name="plus" size="sm" />
          Create invite
        </button>
      </div>

      <div className="invite-lifecycle-metrics" aria-label="Invite lifecycle summary">
        <article className="invite-metric invite-metric--active">
          <span className="invite-metric-icon" aria-hidden="true"><AppIcon name="send" size="sm" /></span>
          <strong>{counts.active}</strong>
          <span>Active</span>
        </article>
        <article className="invite-metric invite-metric--revoked">
          <span className="invite-metric-icon" aria-hidden="true"><AppIcon name="trash" size="sm" /></span>
          <strong>{counts.revoked}</strong>
          <span>Revoked</span>
        </article>
        <article className="invite-metric invite-metric--expired">
          <span className="invite-metric-icon" aria-hidden="true"><AppIcon name="inbox" size="sm" /></span>
          <strong>{counts.expired}</strong>
          <span>Expired</span>
        </article>
        <article className="invite-metric invite-metric--exhausted">
          <span className="invite-metric-icon" aria-hidden="true"><AppIcon name="lock" size="sm" /></span>
          <strong>{counts.exhausted}</strong>
          <span>Use limit</span>
        </article>
      </div>

      <div className="invite-status-filters" role="group" aria-label="Filter invite campaigns">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? "is-active" : ""}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "All" : labelForStatus(item)}
            {item !== "all" ? ` (${counts[item]})` : ""}
          </button>
        ))}
      </div>

      {notice ? (
        <p
          className={notice.error ? "community-mgmt-notice is-error" : "community-mgmt-notice"}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {loading ? (
        <div className="community-mgmt-empty" role="status">
          <strong>Loading invite lifecycle</strong>
          <span>Campaign summaries and usage limits are being prepared.</span>
        </div>
      ) : visible.length ? (
        <div className="invite-campaign-list">
          {visible.map((campaign) => {
            const status = communityInviteService.getLifecycleStatus(campaign);
            const creator =
              community.members.find((member) => member.userId === campaign.createdBy)?.displayName ??
              campaign.creatorName;
            const usagePercent =
              campaign.maxUses != null && campaign.maxUses > 0
                ? Math.min(100, Math.round((campaign.uses / campaign.maxUses) * 100))
                : null;

            return (
              <article key={campaign.id} className="invite-campaign-card">
                <div className={`invite-status-mark invite-status-mark--${status}`} aria-label={labelForStatus(status)}>
                  <AppIcon name={statusIcon(status)} size="sm" />
                </div>

                <div className="invite-campaign-copy">
                  <div className="invite-campaign-title-row">
                    <strong>{campaign.campaignLabel ?? "Community invite"}</strong>
                    <span className={`community-mgmt-badge invite-status-badge invite-status-badge--${status}`}>
                      {labelForStatus(status)}
                    </span>
                  </div>
                  <span>
                    Created by {creator} · {dateTimeService.formatCompactDateTime(campaign.createdAt)}
                  </span>
                  <small>
                    {campaign.expiresAt
                      ? `Expires ${dateTimeService.formatCompactDateTime(campaign.expiresAt)}`
                      : "No expiry"}
                    {campaign.lastUsedAt
                      ? ` · Last used ${dateTimeService.formatCompactDateTime(campaign.lastUsedAt)}`
                      : " · Not used yet"}
                  </small>
                  {usagePercent != null ? (
                    <div className="invite-usage-bar" aria-hidden="true">
                      <span style={{ width: `${usagePercent}%` }} />
                    </div>
                  ) : null}
                </div>

                <div className="invite-usage">
                  <strong>{campaign.uses}</strong>
                  <span>of {campaign.maxUses ?? "∞"}</span>
                </div>

                <button
                  type="button"
                  className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger community-mgmt-action--icon"
                  disabled={!canCreate || status !== "active" || busyId === campaign.id}
                  aria-label={`Revoke ${campaign.campaignLabel ?? "invite"}`}
                  title={status !== "active" ? "Only active invites can be revoked" : "Revoke invite"}
                  onClick={() => setPendingRevoke(campaign)}
                >
                  <AppIcon name="trash" size="sm" />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="community-mgmt-empty invite-empty-state">
          <span className="invite-empty-icon" aria-hidden="true"><AppIcon name="send" size="lg" /></span>
          <strong>No {emptyLabel}</strong>
          <span>Create a limited invite or choose another lifecycle filter.</span>
          <button type="button" className="community-mgmt-action" disabled={!canCreate} onClick={onOpenInvite}>
            <AppIcon name="plus" size="sm" />
            Create invite
          </button>
        </div>
      )}

      {pendingRevoke ? (
        <div
          className="invite-revoke-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="invite-revoke-title"
        >
          <span className="invite-revoke-icon" aria-hidden="true"><AppIcon name="trash" size="lg" /></span>
          <div className="invite-revoke-copy">
            <strong id="invite-revoke-title">Revoke this invite?</strong>
            <p>Existing links stop working immediately. Existing members keep their membership.</p>
          </div>
          <footer className="community-mgmt-footer">
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setPendingRevoke(null)}>
              Keep active
            </button>
            <button
              type="button"
              className="community-mgmt-action community-mgmt-action--danger"
              disabled={busyId === pendingRevoke.id}
              onClick={() => void revoke()}
            >
              Confirm revoke
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
