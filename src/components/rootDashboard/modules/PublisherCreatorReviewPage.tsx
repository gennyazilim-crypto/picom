import { useEffect, useState } from "react";
import { publisherProgramService } from "../../../services/publisher/publisherProgramService";
import type { PublisherReviewQueueItem } from "../../../services/publisher/publisherProgramTypes";
import "../../publisher/publisherProgram.css";

type Access = Readonly<{ allowed: boolean }>;

export function PublisherCreatorReviewPage({ access }: { access: Access }) {
  const [items, setItems] = useState<PublisherReviewQueueItem[]>([]);
  const [status, setStatus] = useState<string>("submitted");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("Reviewed by Root Panel");

  async function refresh() {
    if (!access.allowed) return;
    const result = await publisherProgramService.listReviewQueue({
      status: status || null,
      eligibilityFilter: eligibilityFilter || null,
      limit: 75,
    });
    if (!result.ok) {
      setError(result.error);
      setItems([]);
      return;
    }
    setError(null);
    setItems(result.data);
  }

  useEffect(() => {
    void refresh();
  }, [access.allowed, status, eligibilityFilter]);

  async function decide(item: PublisherReviewQueueItem, decision: "approved" | "rejected" | "under_review" | "suspended") {
    if (!access.allowed) return;
    setBusyId(item.id);
    const result = await publisherProgramService.reviewApplication({
      applicationId: item.id,
      decision,
      reason,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  async function ban(item: PublisherReviewQueueItem) {
    if (!access.allowed) return;
    setBusyId(item.id);
    const result = await publisherProgramService.setLiveBan(item.userId, reason || "Live ban from review panel");
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  return (
    <div className="root-module publisher-program-shell" style={{ padding: 0, background: "transparent" }}>
      <header className="publisher-program-header">
        <div>
          <p className="publisher-eyebrow">Care &amp; Safety</p>
          <h1>Publisher &amp; Creator Review</h1>
          <p>Eşik karşılamak otomatik onay değildir. Snapshot ve güncel sayılar birlikte incelenir.</p>
        </div>
      </header>

      <div className="publisher-card">
        <div className="publisher-header-actions">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="additional_information_required">additional_information_required</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="suspended">suspended</option>
              <option value="">all</option>
            </select>
          </label>
          <label>
            Eligibility filter
            <select value={eligibilityFilter} onChange={(event) => setEligibilityFilter(event.target.value)}>
              <option value="">all</option>
              <option value="follower">Takipçi kriteriyle</option>
              <option value="community">Topluluk kriteriyle</option>
              <option value="both">Her iki kriter</option>
              <option value="below_threshold">Artık eşiğin altında</option>
              <option value="fraud_review">Fraud incelemesi</option>
            </select>
          </label>
          <label>
            Decision reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" className="publisher-ghost" onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      {error ? <p className="publisher-error" role="alert">{error}</p> : null}

      <div className="publisher-card publisher-review-grid">
        {items.map((item) => {
          const followerDrop = item.followerCountAtApplication - item.currentFollowerCount;
          const memberDrop = item.communityMemberCountAtApplication - item.currentCommunityMemberCount;
          return (
            <article key={item.id} className="publisher-review-item">
              <header>
                <strong>{item.displayPublisherName}</strong> · {item.applicationType} · {item.status}
                <div>{item.displayName} @{item.username}</div>
              </header>
              <p>{item.shortBio}</p>
              <dl className="publisher-stats">
                <div>
                  <dt>Eligibility paths</dt>
                  <dd>{item.eligibilityPaths.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Followers (app → now)</dt>
                  <dd>{item.followerCountAtApplication} → {item.currentFollowerCount} ({followerDrop >= 0 ? "-" : "+"}{Math.abs(followerDrop)})</dd>
                </div>
                <div>
                  <dt>Community members (app → now)</dt>
                  <dd>{item.communityMemberCountAtApplication} → {item.currentCommunityMemberCount} ({memberDrop >= 0 ? "-" : "+"}{Math.abs(memberDrop)})</dd>
                </div>
                <div>
                  <dt>Qualified community</dt>
                  <dd>
                    {item.qualifiedCommunityName || "—"}
                    {item.isStillCommunityOwner ? " (owner)" : " (not owner now)"}
                  </dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>{item.eligibilityRiskStatus}</dd>
                </div>
              </dl>
              {(followerDrop > 500 || memberDrop > 300) ? (
                <p className="publisher-error">Risk uyarısı: başvuru sonrası olağan dışı sayı düşüşü.</p>
              ) : null}
              <div className="publisher-review-actions">
                <button type="button" className="publisher-primary" disabled={busyId === item.id} onClick={() => void decide(item, "approved")}>Approve</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "under_review")}>Under review</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "rejected")}>Reject</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "suspended")}>Suspend</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void ban(item)}>Live ban</button>
              </div>
            </article>
          );
        })}
        {items.length === 0 ? <p>Kuyruk boş.</p> : null}
      </div>
    </div>
  );
}
