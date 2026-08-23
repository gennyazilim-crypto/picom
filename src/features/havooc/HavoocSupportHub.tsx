import { AppIcon } from "../../components/AppIcon";
import { useTranslation } from "../../i18n";
import { HAVOOC_DEVELOPMENT_GOAL_EUR, HAVOOC_LINKS } from "./havoocConfig";
import { SupportNotesSection } from "./SupportNotesSection";
import "../../components/ProfileView.css";
import "./HavoocSupportHub.css";

type ToastTone = "info" | "success" | "error";

export type HavoocSupportHubProps = Readonly<{
  authenticated: boolean;
  canModerate?: boolean;
  onBack?: () => void;
  onRequestAuth: () => void;
  onOpenProfile?: (username: string, userId: string) => void;
  pushToast: (message: string, tone?: ToastTone) => void;
}>;

/**
 * HAVOOC Support Hub — profile-page layout (identity rail + content panels).
 * Support Notes is the production section; Roadmap / Media remain structural placeholders.
 */
export function HavoocSupportHub({
  authenticated,
  canModerate = false,
  onBack,
  onRequestAuth,
  onOpenProfile,
  pushToast,
}: HavoocSupportHubProps) {
  const { t } = useTranslation("havooc");
  const goalLabel = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(HAVOOC_DEVELOPMENT_GOAL_EUR);

  return (
    <main className="profile-view havooc-hub" aria-label={t("hub.pageAria")}>
      <div className="profile-page-shell">
        <aside className="profile-rail" aria-label={t("hub.railAria")}>
          <article className="profile-identity-card">
            <div className="profile-identity-cover havooc-hub__cover" role="img" aria-label="HAVOOC" />
            <div className="profile-identity-body">
              <div className="havooc-hub__avatar" aria-hidden="true">
                H
              </div>
              <div className="profile-identity-headline">
                <span className="profile-presence-pill havooc-hub__status-pill">
                  <i aria-hidden="true" />
                  {t("hub.statusPill")}
                </span>
                <h1>HAVOOC</h1>
                <p className="profile-handle">@{t("hub.handle")}</p>
                <p className="profile-tagline">{t("hub.lede")}</p>
              </div>

              <div className="profile-rail-stats" aria-label={t("hub.statsAria")}>
                <div className="profile-rail-stat">
                  <strong>{goalLabel}</strong>
                  <span>{t("hub.statGoal")}</span>
                </div>
                <div className="profile-rail-stat">
                  <strong>{t("hub.statNotesValue")}</strong>
                  <span>{t("hub.statNotes")}</span>
                </div>
              </div>

              <dl className="profile-identity-facts">
                <div>
                  <dt>
                    <AppIcon name="pin" size="xs" aria-hidden="true" />
                    {t("hub.factWebsite")}
                  </dt>
                  <dd>
                    <a href={HAVOOC_LINKS.website} target="_blank" rel="noreferrer">
                      havooc.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>
                    <AppIcon name="users" size="xs" aria-hidden="true" />
                    {t("hub.factCampaign")}
                  </dt>
                  <dd>{t("hub.factCampaignValue")}</dd>
                </div>
              </dl>

              <div className="profile-action-row" role="group" aria-label={t("supportNotes.cta.aria")}>
                <a
                  className="profile-btn profile-btn--primary profile-btn--block"
                  href={HAVOOC_LINKS.donate}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="profile-btn-label">{t("supportNotes.cta.donate")}</span>
                </a>
                <div className="profile-action-secondary profile-action-secondary--compact">
                  <a
                    className="profile-btn profile-btn--ghost profile-btn--secondary"
                    href={HAVOOC_LINKS.support}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="profile-btn-label">{t("supportNotes.cta.support")}</span>
                  </a>
                  <a
                    className="profile-btn profile-btn--ghost profile-btn--secondary"
                    href={HAVOOC_LINKS.kickstarter}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="profile-btn-label">{t("hub.kickstarterCta")}</span>
                  </a>
                </div>
              </div>

              {onBack ? (
                <button type="button" className="profile-btn profile-btn--ghost profile-btn--block" onClick={onBack}>
                  <span className="profile-btn-label">{t("hub.back")}</span>
                </button>
              ) : null}
            </div>
          </article>

          <section className="profile-panel" aria-labelledby="havooc-community-title">
            <header className="profile-panel-header profile-panel-header--compact">
              <h2 id="havooc-community-title">{t("hub.communityTitle")}</h2>
            </header>
            <div className="havooc-hub__link-row">
              <a className="havooc-hub__text-link" href={HAVOOC_LINKS.community.picom} target="_blank" rel="noreferrer">
                PICOM
              </a>
              <a className="havooc-hub__text-link" href={HAVOOC_LINKS.community.reddit} target="_blank" rel="noreferrer">
                Reddit
              </a>
              <a className="havooc-hub__text-link" href={HAVOOC_LINKS.community.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </div>
          </section>
        </aside>

        <section className="profile-content" aria-label={t("hub.contentAria")}>
          <section className="profile-panel profile-overview-panel" aria-labelledby="havooc-roadmap-title">
            <div className="profile-overview-body">
              <div className="profile-overview-block">
                <h2 className="profile-overview-title" id="havooc-roadmap-title">
                  {t("hub.roadmapTitle")}
                </h2>
                <p className="profile-bio-copy havooc-hub__pending">{t("hub.sectionPending")}</p>
              </div>
            </div>
          </section>

          <section className="profile-panel" aria-labelledby="havooc-media-title">
            <header className="profile-panel-header profile-panel-header--compact">
              <h2 id="havooc-media-title">{t("hub.mediaTitle")}</h2>
            </header>
            <p className="havooc-hub__pending">{t("hub.sectionPending")}</p>
          </section>

          <SupportNotesSection
            authenticated={authenticated}
            canModerate={canModerate}
            onRequestAuth={onRequestAuth}
            onOpenProfile={onOpenProfile}
            pushToast={pushToast}
          />
        </section>
      </div>
    </main>
  );
}
