import { FIRST_LAUNCH_PURPOSE_IDS, type FirstLaunchPlan, type FirstLaunchPurposeId } from "../../services/firstLaunchPersonalization";
import { getFirstLaunchStep, type FirstLaunchStepId } from "../../services/firstLaunchSetupSteps";
import { AppIcon, type IconName } from "../AppIcon";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type FirstLaunchPersonalizeProps = {
  selectedPurposeIds: readonly FirstLaunchPurposeId[];
  reviewAllSetup: boolean;
  plan: FirstLaunchPlan;
  t: Translate;
  onTogglePurpose: (purposeId: FirstLaunchPurposeId) => void;
  onReviewAllChange: (enabled: boolean) => void;
};

const PURPOSE_ICONS: Readonly<Record<FirstLaunchPurposeId, IconName>> = {
  friends: "users",
  communities: "hash",
  gaming: "play",
  work: "inbox",
  creator: "camera",
};

function purposeTitleKey(purposeId: FirstLaunchPurposeId): `personalize.purposes.${FirstLaunchPurposeId}.title` {
  return `personalize.purposes.${purposeId}.title`;
}

function purposeBodyKey(purposeId: FirstLaunchPurposeId): `personalize.purposes.${FirstLaunchPurposeId}.body` {
  return `personalize.purposes.${purposeId}.body`;
}

function stepLabel(stepId: FirstLaunchStepId, t: Translate): string {
  const step = getFirstLaunchStep(stepId);
  return step ? t(step.labelKey) : stepId;
}

export function FirstLaunchPersonalize({
  selectedPurposeIds,
  reviewAllSetup,
  plan,
  t,
  onTogglePurpose,
  onReviewAllChange,
}: FirstLaunchPersonalizeProps) {
  const previewStepIds = plan.includedStepIds.filter((stepId) => stepId !== "welcome" && stepId !== "personalize");
  const tailored = selectedPurposeIds.length
    ? t("personalize.tailoredFor", {
      purposes: selectedPurposeIds.map((purposeId) => t(purposeTitleKey(purposeId))).join(t("personalize.purposeJoin")),
    })
    : t("personalize.noSelection");

  return (
    <div className="first-launch-personalize">
      <p className="first-launch-personalize-hint">{t("personalize.multiSelectHint")}</p>
      <fieldset className="first-launch-purpose-grid">
        <legend className="sr-only">{t("personalize.legend")}</legend>
        {FIRST_LAUNCH_PURPOSE_IDS.map((purposeId) => {
          const selected = selectedPurposeIds.includes(purposeId);
          return (
            <label key={purposeId} className={`first-launch-purpose-card${selected ? " is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onTogglePurpose(purposeId)}
              />
              <span className="first-launch-purpose-icon" aria-hidden="true">
                <AppIcon name={PURPOSE_ICONS[purposeId]} size="md" />
              </span>
              <span className="first-launch-purpose-copy">
                <strong>{t(purposeTitleKey(purposeId))}</strong>
                <small>{t(purposeBodyKey(purposeId))}</small>
              </span>
              <span className="first-launch-purpose-check" aria-hidden="true">{selected ? "✓" : ""}</span>
            </label>
          );
        })}
      </fieldset>

      <section className="first-launch-plan-preview" aria-labelledby="first-launch-plan-preview-title">
        <h2 id="first-launch-plan-preview-title">{t("personalize.planPreviewTitle")}</h2>
        <p className="first-launch-plan-preview-context">{tailored}</p>
        <ol>
          {previewStepIds.map((stepId) => (
            <li key={stepId}>{stepLabel(stepId, t)}</li>
          ))}
        </ol>
      </section>

      <label className="first-launch-review-all">
        <input
          type="checkbox"
          checked={reviewAllSetup}
          onChange={(event) => onReviewAllChange(event.target.checked)}
        />
        <span>
          <strong>{t("personalize.reviewAll")}</strong>
          <small>{t("personalize.reviewAllHint")}</small>
        </span>
      </label>
    </div>
  );
}
