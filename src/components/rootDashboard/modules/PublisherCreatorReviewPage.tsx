import { useEffect, useState } from "react";
import { localizationService } from "../../../services/localizationService";
import {
  translatePublisherProgram,
  type PublisherProgramI18nKey,
} from "../../../services/localization/publisherProgramCatalog";
import { publisherProgramService } from "../../../services/publisher/publisherProgramService";
import type { PublisherReviewQueueItem } from "../../../services/publisher/publisherProgramTypes";
import "../../publisher/publisherProgram.css";

type Access = Readonly<{ allowed: boolean }>;

function t(key: PublisherProgramI18nKey, params?: Record<string, string | number>): string {
  return translatePublisherProgram(key, localizationService.getLanguage(), params);
}

export function PublisherCreatorReviewPage({ access }: { access: Access }) {
  const [items, setItems] = useState<PublisherReviewQueueItem[]>([]);
  const [status, setStatus] = useState<string>("submitted");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState(() => t("review.defaultReason"));

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
    const result = await publisherProgramService.setLiveBan(item.userId, reason || t("review.banReason"));
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
          <p className="publisher-eyebrow">{t("review.eyebrow")}</p>
          <h1>{t("review.title")}</h1>
          <p>{t("review.lede")}</p>
        </div>
      </header>

      <div className="publisher-card">
        <div className="publisher-header-actions">
          <label>
            {t("review.status")}
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="additional_information_required">additional_information_required</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="suspended">suspended</option>
              <option value="">{t("review.filter.all")}</option>
            </select>
          </label>
          <label>
            {t("review.eligibility")}
            <select value={eligibilityFilter} onChange={(event) => setEligibilityFilter(event.target.value)}>
              <option value="">{t("review.filter.all")}</option>
              <option value="follower">{t("review.filter.follower")}</option>
              <option value="community">{t("review.filter.community")}</option>
              <option value="both">{t("review.filter.both")}</option>
              <option value="below_threshold">{t("review.filter.below")}</option>
              <option value="fraud_review">{t("review.filter.fraud")}</option>
            </select>
          </label>
          <label>
            {t("review.reason")}
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" className="publisher-ghost" onClick={() => void refresh()}>{t("review.refresh")}</button>
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
                  <dt>{t("review.paths")}</dt>
                  <dd>{item.eligibilityPaths.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>{t("review.followers")}</dt>
                  <dd>{item.followerCountAtApplication} → {item.currentFollowerCount} ({followerDrop >= 0 ? "-" : "+"}{Math.abs(followerDrop)})</dd>
                </div>
                <div>
                  <dt>{t("review.members")}</dt>
                  <dd>{item.communityMemberCountAtApplication} → {item.currentCommunityMemberCount} ({memberDrop >= 0 ? "-" : "+"}{Math.abs(memberDrop)})</dd>
                </div>
                <div>
                  <dt>{t("review.community")}</dt>
                  <dd>
                    {item.qualifiedCommunityName || "—"}
                    {item.isStillCommunityOwner ? t("review.owner") : t("review.notOwner")}
                  </dd>
                </div>
                <div>
                  <dt>{t("review.risk")}</dt>
                  <dd>{item.eligibilityRiskStatus}</dd>
                </div>
              </dl>
              {(followerDrop > 500 || memberDrop > 300) ? (
                <p className="publisher-error">{t("review.riskDrop")}</p>
              ) : null}
              <div className="publisher-review-actions">
                <button type="button" className="publisher-primary" disabled={busyId === item.id} onClick={() => void decide(item, "approved")}>{t("review.approve")}</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "under_review")}>{t("review.underReview")}</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "rejected")}>{t("review.reject")}</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void decide(item, "suspended")}>{t("review.suspend")}</button>
                <button type="button" className="publisher-ghost" disabled={busyId === item.id} onClick={() => void ban(item)}>{t("review.liveBan")}</button>
              </div>
            </article>
          );
        })}
        {items.length === 0 ? <p>{t("review.empty")}</p> : null}
      </div>
    </div>
  );
}
