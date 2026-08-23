import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";
import { localizationService } from "../../services/localizationService";
import { getUiLanguageBcp47 } from "../../services/localization/uiLanguages";
import {
  formatPublisherCount,
  translatePublisherProgram,
  type PublisherProgramI18nKey,
} from "../../services/localization/publisherProgramCatalog";
import { publisherProgramService } from "../../services/publisher/publisherProgramService";
import type {
  PublisherApplicationEligibility,
  PublisherApplicationSummary,
  PublisherApplicationType,
} from "../../services/publisher/publisherProgramTypes";
import "./publisherProgram.css";

type Props = Readonly<{
  onClose: () => void;
  onOpenDashboard?: () => void;
}>;

function t(key: PublisherProgramI18nKey, params?: Record<string, string | number>): string {
  return translatePublisherProgram(key, localizationService.getLanguage(), params);
}

function formatCount(value: number): string {
  return formatPublisherCount(value, localizationService.getLanguage());
}

function eligibilityMessage(eligibility: PublisherApplicationEligibility): string {
  const paths = eligibility.eligibilityPaths ?? [];
  if (!eligibility.eligible) return t("apply.elig.notEligible");
  if (paths.includes("follower_threshold") && paths.includes("community_founder_threshold")) {
    return t("apply.elig.both");
  }
  if (paths.includes("follower_threshold")) return t("apply.elig.followers");
  if (paths.includes("community_founder_threshold")) return t("apply.elig.community");
  return t("apply.elig.ok");
}

function closerPathLabel(followerRemaining: number, communityRemaining: number): string {
  if (followerRemaining === communityRemaining) return t("apply.closer.tie");
  if (followerRemaining < communityRemaining) return t("apply.closer.followers");
  return t("apply.closer.community");
}

function CriterionTrack({
  label,
  current,
  required,
  detail,
  met,
}: Readonly<{
  label: string;
  current: number;
  required: number;
  detail: string;
  met: boolean;
}>) {
  const ratio = required > 0 ? Math.min(1, current / required) : 0;
  const percent = Math.round(ratio * 100);
  const remaining = Math.max(0, required - current);

  return (
    <article className={`publisher-track${met ? " is-met" : ""}`} aria-label={label}>
      <div className="publisher-track__top">
        <div>
          <p className="publisher-track__label">{label}</p>
          <p className="publisher-track__detail">{detail}</p>
        </div>
        <span className={`publisher-track__badge${met ? " is-met" : ""}`}>
          {met ? t("apply.track.met") : `${percent}%`}
        </span>
      </div>
      <div
        className="publisher-track__meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={Math.min(current, required)}
        aria-label={t("apply.track.progressAria", { label })}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="publisher-track__footer">
        <strong>
          {formatCount(current)} / {formatCount(required)}
        </strong>
        <span>{met ? t("apply.track.open") : t("apply.track.remaining", { count: formatCount(remaining) })}</span>
      </div>
    </article>
  );
}

export function PublisherApplicationWorkspace({ onClose, onOpenDashboard }: Props) {
  const [eligibility, setEligibility] = useState<PublisherApplicationEligibility | null>(null);
  const [applications, setApplications] = useState<PublisherApplicationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applicationType, setApplicationType] = useState<PublisherApplicationType>("creator");
  const [displayName, setDisplayName] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [canBroadcast, setCanBroadcast] = useState(false);
  const language = localizationService.getLanguage();

  async function refresh() {
    setError(null);
    const [elig, apps, program] = await Promise.all([
      publisherProgramService.getEligibility(),
      publisherProgramService.listOwnApplications(),
      publisherProgramService.getProgramState(),
    ]);
    if (!elig.ok) {
      setError(elig.error);
      setEligibility(null);
      return;
    }
    setEligibility(elig.data);
    if (apps.ok) setApplications(apps.data);
    if (program.ok) setCanBroadcast(program.data.canBroadcast);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit() {
    if (!eligibility?.eligible) return;
    setBusy(true);
    setError(null);
    const result = await publisherProgramService.submitApplication({
      applicationType,
      displayPublisherName: displayName,
      shortBio,
      companyName: applicationType === "publisher" ? companyName : null,
      categories: ["general"],
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  const paths = eligibility?.eligibilityPaths ?? [];
  const followerCount = eligibility?.activeFollowerCount ?? 0;
  const followerRequired = eligibility?.requiredFollowerCount ?? 0;
  const memberCount = eligibility?.largestOwnedCommunityActiveMemberCount ?? 0;
  const communityRequired = eligibility?.requiredCommunityMemberCount ?? 0;
  const followerMet = paths.includes("follower_threshold") || followerCount >= followerRequired;
  const communityMet = paths.includes("community_founder_threshold") || memberCount >= communityRequired;
  const followerRemaining = Math.max(0, followerRequired - followerCount);
  const communityRemaining = Math.max(0, communityRequired - memberCount);

  return (
    <section className="publisher-program-shell publisher-program-shell--application" aria-label={t("apply.aria")}>
      <header className="publisher-program-header">
        <div className="publisher-program-header__copy">
          <div className="publisher-eyebrow-row">
            <p className="publisher-eyebrow">{t("apply.eyebrow")}</p>
            {eligibility ? (
              <span className={`publisher-status-chip${eligibility.eligible ? " is-ready" : ""}`}>
                {eligibility.eligible ? t("apply.ready") : t("apply.belowThreshold")}
              </span>
            ) : null}
          </div>
          <h1>{t("apply.title")}</h1>
          <p className="publisher-program-header__lede">{t("apply.lede")}</p>
        </div>
        <div className="publisher-header-actions">
          <button type="button" className="publisher-ghost" onClick={() => void refresh()} aria-label={t("apply.refreshAria")}>
            <AppIcon name="refresh" size="sm" />
            {t("apply.refresh")}
          </button>
          {canBroadcast && onOpenDashboard ? (
            <button type="button" className="publisher-primary" onClick={onOpenDashboard}>
              {t("apply.dashboard")}
            </button>
          ) : null}
          <button type="button" className="publisher-ghost" onClick={onClose}>
            {t("apply.close")}
          </button>
        </div>
      </header>

      {error ? (
        <p className="publisher-error" role="alert">
          {error}
        </p>
      ) : null}

      {!eligibility ? (
        <div className="publisher-panel publisher-panel--loading" aria-live="polite">
          <span className="publisher-loading-dot" aria-hidden="true" />
          {t("apply.loading")}
        </div>
      ) : (
        <div className="publisher-program-layout">
          <div className="publisher-program-main">
            <section className="publisher-panel publisher-snapshot" aria-labelledby="publisher-snapshot-title">
              <div className="publisher-snapshot__head">
                <div>
                  <h2 id="publisher-snapshot-title">{t("apply.snapshotTitle")}</h2>
                  <p>{eligibilityMessage(eligibility)}</p>
                </div>
                <time dateTime={eligibility.evaluatedAt} className="publisher-eligibility__time">
                  {t("apply.lastCheck", {
                    time: new Date(eligibility.evaluatedAt).toLocaleString(getUiLanguageBcp47(language)),
                  })}
                </time>
              </div>
              <dl className="publisher-snapshot__grid">
                <div>
                  <dt>{t("apply.followers")}</dt>
                  <dd>
                    {formatCount(followerCount)}
                    <span> / {formatCount(followerRequired)}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t("apply.largestCommunity")}</dt>
                  <dd>
                    {formatCount(memberCount)}
                    <span> / {formatCount(communityRequired)}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t("apply.countedCommunity")}</dt>
                  <dd className="publisher-snapshot__text">
                    {eligibility.largestOwnedCommunityName?.trim() || t("apply.noCommunity")}
                  </dd>
                </div>
                <div>
                  <dt>{t("apply.accountGate")}</dt>
                  <dd className="publisher-snapshot__text">
                    {eligibility.hasActiveLiveBan
                      ? t("apply.liveBan")
                      : eligibility.accountActive === false
                        ? t("apply.accountInactive")
                        : t("apply.accountOk")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="publisher-panel publisher-eligibility" aria-labelledby="publisher-eligibility-title">
              <div className="publisher-eligibility__intro">
                <div>
                  <h2 id="publisher-eligibility-title">{t("apply.pathsTitle")}</h2>
                  <p>{t("apply.pathsBody")}</p>
                </div>
              </div>

              <div className="publisher-tracks" role="list">
                <CriterionTrack
                  label={t("apply.followerPath")}
                  current={followerCount}
                  required={followerRequired}
                  detail={t("apply.followerDetail")}
                  met={followerMet}
                />
                <div className="publisher-tracks__or" aria-hidden="true">
                  <span>{t("apply.or")}</span>
                </div>
                <CriterionTrack
                  label={t("apply.communityPath")}
                  current={memberCount}
                  required={communityRequired}
                  detail={
                    eligibility.largestOwnedCommunityName
                      ? t("apply.communityDetailNamed", { name: eligibility.largestOwnedCommunityName })
                      : t("apply.communityDetailDefault")
                  }
                  met={communityMet}
                />
              </div>
            </section>

            {applications.length > 0 ? (
              <section className="publisher-panel" aria-labelledby="publisher-apps-title">
                <h2 id="publisher-apps-title">{t("apply.applicationsTitle")}</h2>
                <ul className="publisher-app-list">
                  {applications.map((app) => (
                    <li key={app.id}>
                      <div>
                        <strong>{app.displayPublisherName}</strong>
                        <span>
                          {app.applicationType} · {app.status}
                          {app.submittedAt
                            ? ` · ${new Date(app.submittedAt).toLocaleDateString()}`
                            : ""}
                        </span>
                      </div>
                      <AppIcon name="chevronRight" size="sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {eligibility.eligible ? (
              <form
                className="publisher-panel publisher-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSubmit();
                }}
              >
                <div className="publisher-form__intro">
                  <h2>{t("apply.formTitle")}</h2>
                  <p>{t("apply.formLede")}</p>
                </div>
                <label>
                  {t("apply.typeLabel")}
                  <select
                    value={applicationType}
                    onChange={(event) => setApplicationType(event.target.value as PublisherApplicationType)}
                  >
                    <option value="creator">{t("apply.typeCreator")}</option>
                    <option value="publisher">{t("apply.typePublisher")}</option>
                  </select>
                </label>
                <label>
                  {t("apply.displayName")}
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder={t("apply.displayPlaceholder")}
                  />
                </label>
                <label>
                  {t("apply.bio")}
                  <textarea
                    value={shortBio}
                    onChange={(event) => setShortBio(event.target.value)}
                    required
                    minLength={20}
                    maxLength={2000}
                    rows={5}
                    placeholder={t("apply.bioPlaceholder")}
                  />
                </label>
                {applicationType === "publisher" ? (
                  <label>
                    {t("apply.company")}
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </label>
                ) : null}
                <button type="submit" className="publisher-primary publisher-form__submit" disabled={busy}>
                  {busy ? t("apply.submitting") : t("apply.submit")}
                </button>
              </form>
            ) : (
              <section className="publisher-panel publisher-next" aria-labelledby="publisher-next-title">
                <h2 id="publisher-next-title">{t("apply.nextTitle")}</h2>
                <p>{closerPathLabel(followerRemaining, communityRemaining)}</p>
                <div className="publisher-next__grid">
                  <article>
                    <h3>{t("apply.growFollowersTitle")}</h3>
                    <p>{t("apply.growFollowersBody", { count: formatCount(followerRemaining) })}</p>
                  </article>
                  <article>
                    <h3>{t("apply.growCommunityTitle")}</h3>
                    <p>
                      {eligibility.largestOwnedCommunityName
                        ? t("apply.growCommunityBodyNamed", {
                            name: eligibility.largestOwnedCommunityName,
                            count: formatCount(communityRemaining),
                          })
                        : t("apply.growCommunityBodyDefault", { count: formatCount(communityRemaining) })}
                    </p>
                  </article>
                </div>
              </section>
            )}
          </div>

          <aside className="publisher-program-aside" aria-label={t("apply.asideLabel")}>
            <section className="publisher-aside-card">
              <p className="publisher-aside-kicker">{t("apply.afterKicker")}</p>
              <h2>{t("apply.afterTitle")}</h2>
              <ul className="publisher-aside-list">
                <li>{t("apply.afterBadge")}</li>
                <li>{t("apply.afterDiscovery")}</li>
                <li>{t("apply.afterGate")}</li>
                <li>{t("apply.afterSafety")}</li>
              </ul>
            </section>

            <section className="publisher-aside-card">
              <p className="publisher-aside-kicker">{t("apply.processKicker")}</p>
              <h2>{t("apply.processTitle")}</h2>
              <ol className="publisher-aside-steps">
                <li>{t("apply.processStep1")}</li>
                <li>{t("apply.processStep2")}</li>
                <li>{t("apply.processStep3")}</li>
                <li>{t("apply.processStep4")}</li>
              </ol>
            </section>

            <section className="publisher-aside-card publisher-aside-card--muted">
              <p className="publisher-aside-kicker">{t("apply.rulesKicker")}</p>
              <h2>{t("apply.rulesTitle")}</h2>
              <ul className="publisher-aside-list">
                <li>{t("apply.rulesFollowers", { count: formatCount(followerRequired) })}</li>
                <li>{t("apply.rulesCommunity", { count: formatCount(communityRequired) })}</li>
                <li>{t("apply.rulesOwner")}</li>
                <li>{t("apply.rulesNoMerge")}</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
