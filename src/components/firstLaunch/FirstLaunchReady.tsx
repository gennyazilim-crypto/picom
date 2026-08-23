import { AppIcon, type IconName } from "../AppIcon";
import type { FirstLaunchReadySection, FirstLaunchReadyState } from "../../services/firstLaunchReadyState";
import type { FirstProductActionId } from "../../services/firstLaunchProductActions";
import type { FirstLaunchStepId } from "../../services/firstLaunchSetupSteps";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type FirstLaunchReadyProps = Readonly<{
  ready: FirstLaunchReadyState;
  t: Translate;
  languageLabel: string;
  completing: boolean;
  completionError: boolean;
  onReview: (stepId: FirstLaunchStepId) => void;
  onReviewAll: () => void;
  onProductAction: (actionId: FirstProductActionId) => void;
}>;

const SECTION_ICONS: Readonly<Record<FirstLaunchReadySection["id"], IconName>> = {
  appearance: "sun",
  "audio-video": "camera",
  desktop: "settings",
  notifications: "bell",
  privacy: "lock",
};

function rowValue(t: Translate, languageLabel: string, row: FirstLaunchReadyState["sections"][number]["rows"][number]): string {
  if (row.id === "language") return languageLabel;
  if (row.valueKey) return t(row.valueKey, row.valueParams);
  return row.valueText ?? "";
}

function ReadySection({
  section,
  t,
  languageLabel,
  completing,
  onReview,
}: Readonly<{
  section: FirstLaunchReadySection;
  t: Translate;
  languageLabel: string;
  completing: boolean;
  onReview: (stepId: FirstLaunchStepId) => void;
}>) {
  return (
    <section className="first-launch-ready-section" aria-labelledby={`first-launch-ready-${section.id}`}>
      <h3 id={`first-launch-ready-${section.id}`}>
        <AppIcon name={SECTION_ICONS[section.id]} size="sm" />
        {t(section.labelKey)}
      </h3>
      <ul className="first-launch-ready-rows">
        {section.rows.map((row) => (
          <li key={row.id} className={`is-${row.severity}`}>
            <div>
              <span>{t(row.labelKey)}</span>
              <strong data-status={row.status}>{rowValue(t, languageLabel, row)}</strong>
            </div>
            {row.reviewStepId && row.reviewLabelKey ? (
              <button
                type="button"
                className="first-launch-ready-review"
                disabled={completing}
                onClick={() => onReview(row.reviewStepId!)}
                aria-label={t(row.reviewLabelKey)}
              >
                {t(row.status === "not-in-plan" ? "ready.configure" : row.severity === "attention" ? "ready.fix" : "ready.review")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FirstLaunchReady({
  ready,
  t,
  languageLabel,
  completing,
  completionError,
  onReview,
  onReviewAll,
  onProductAction,
}: FirstLaunchReadyProps) {
  const included = ready.sections.filter((section) => section.participation !== "omitted");
  const omitted = ready.sections.filter((section) => section.participation === "omitted");

  return (
    <div className="first-launch-ready">
      <div className="first-launch-ready-main">
        <section className="first-launch-ready-health" aria-labelledby="first-launch-ready-health-heading">
          <h2 id="first-launch-ready-health-heading">{t("ready.setupHealth")}</h2>
          {included.map((section) => (
            <ReadySection
              key={section.id}
              section={section}
              t={t}
              languageLabel={languageLabel}
              completing={completing}
              onReview={onReview}
            />
          ))}
        </section>

        {omitted.length ? (
          <section className="first-launch-ready-other" aria-labelledby="first-launch-ready-other-heading">
            <h2 id="first-launch-ready-other-heading">{t("ready.otherAreas")}</h2>
            <ul className="first-launch-ready-omitted">
              {omitted.map((section) => (
                <li key={section.id}>{t(section.labelKey)}</li>
              ))}
            </ul>
            <button type="button" className="secondary first-launch-review-setup" disabled={completing} onClick={onReviewAll}>
              {t("ready.reviewAllOptions")}
            </button>
          </section>
        ) : null}

        <p className="first-launch-ready-helper">{t("ready.changeLater")}</p>
        {completionError ? (
          <p className="first-launch-ready-error" role="alert">
            {t("ready.error.save")} {t("ready.error.retry")}
          </p>
        ) : null}
      </div>

      <aside className="first-launch-ready-aside">
        {ready.showProductActions && ready.productActions.length ? (
          <section className="first-launch-ready-actions" aria-labelledby="first-launch-ready-actions-heading">
            <h2 id="first-launch-ready-actions-heading">{t("ready.firstActions")}</h2>
            <div className="first-launch-ready-action-list">
              {ready.productActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="secondary"
                  disabled={completing}
                  onClick={() => onProductAction(action.id)}
                >
                  {t(action.labelKey)}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="first-launch-product-preview" aria-label={t("welcome.previewLabel")}>
            <header>
              <span aria-hidden="true">P</span>
              <strong>{t("welcome.previewTitle")}</strong>
              <i />
            </header>
            <div>
              <aside>
                <span>{t("welcome.previewCommunities")}</span>
                <span>{t("welcome.previewMessages")}</span>
              </aside>
              <section>
                <strong>{t("welcome.previewConversation")}</strong>
                <p>{t("welcome.previewMessage")}</p>
                <p>{t("welcome.previewReply")}</p>
              </section>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
