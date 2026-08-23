import { AppIcon } from "../AppIcon";
import type { OnboardingProfileBasics } from "../../types/onboarding";
import { useTranslation } from "../../i18n";

type Props = { value: OnboardingProfileBasics; onChange: (value: OnboardingProfileBasics) => void };

export function OnboardingStepProfile({ value, onChange }: Props) {
  const { t } = useTranslation("common");
  const initials = value.displayName.trim().slice(0, 2).toUpperCase() || "P";
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-profile-title">
      <div className="onboarding-step-heading">
        <span className="onboarding-step-icon"><AppIcon name="user" size="lg" /></span>
        <div><p className="eyebrow">{t("onboarding.profileBasics")}</p><h2 id="onboarding-profile-title">{t("onboarding.profileTitle")}</h2><p>{t("onboarding.profileBody")}</p></div>
      </div>
      <div className="onboarding-profile-layout">
        <div className="onboarding-avatar-preview" aria-label="Profile avatar preview">{initials}</div>
        <div className="onboarding-fields">
          <label><span>{t("onboarding.displayName")}</span><input autoFocus maxLength={80} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} placeholder={t("onboarding.displayNamePlaceholder")} /></label>
          <label><span>{t("onboarding.username")} <em>{t("onboarding.optional")}</em></span><input maxLength={32} value={value.username} onChange={(event) => onChange({ ...value, username: event.target.value })} placeholder="your-handle" /></label>
          <label><span>{t("onboarding.statusText")} <em>{t("onboarding.optional")}</em></span><input maxLength={120} value={value.statusText} onChange={(event) => onChange({ ...value, statusText: event.target.value })} placeholder={t("onboarding.statusPlaceholder")} /></label>
          <p className="onboarding-field-note">{t("onboarding.avatarNote")}</p>
        </div>
      </div>
    </section>
  );
}
