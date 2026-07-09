import type { ThemeMode } from "../../services/settingsService";
import { AppIcon } from "../AppIcon";

type Props = { theme: ThemeMode; onChange: (theme: ThemeMode) => void };

export function OnboardingStepTheme({ theme, onChange }: Props) {
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-theme-title">
      <div className="onboarding-step-heading"><span className="onboarding-step-icon"><AppIcon name={theme === "dark" ? "moon" : "sun"} size="lg" /></span><div><p className="eyebrow">Appearance</p><h2 id="onboarding-theme-title">Choose your desktop theme</h2><p>The choice applies immediately and can be changed later in Settings.</p></div></div>
      <div className="onboarding-theme-grid" role="radiogroup" aria-label="Choose theme">
        {(["light", "dark"] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={theme === option} className={`onboarding-theme-card ${theme === option ? "selected" : ""}`} onClick={() => onChange(option)}><span className={`onboarding-theme-preview ${option}`}><i /><i /><i /></span><strong><AppIcon name={option === "light" ? "sun" : "moon"} size="sm" /> {option === "light" ? "Light" : "Dark"}</strong><small>{option === "light" ? "Bright, calm surfaces" : "Soft charcoal surfaces"}</small></button>)}
      </div>
      <p className="onboarding-field-note">System theme detection remains a safe future placeholder.</p>
    </section>
  );
}
