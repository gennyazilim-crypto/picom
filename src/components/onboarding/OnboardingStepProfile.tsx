import { AppIcon } from "../AppIcon";
import type { OnboardingProfileBasics } from "../../types/onboarding";

type Props = { value: OnboardingProfileBasics; onChange: (value: OnboardingProfileBasics) => void };

export function OnboardingStepProfile({ value, onChange }: Props) {
  const initials = value.displayName.trim().slice(0, 2).toUpperCase() || "P";
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-profile-title">
      <div className="onboarding-step-heading">
        <span className="onboarding-step-icon"><AppIcon name="user" size="lg" /></span>
        <div><p className="eyebrow">Profile basics</p><h2 id="onboarding-profile-title">Make Picom feel like yours</h2><p>Your display name and status help people recognize you across communities.</p></div>
      </div>
      <div className="onboarding-profile-layout">
        <div className="onboarding-avatar-preview" aria-label="Profile avatar preview">{initials}</div>
        <div className="onboarding-fields">
          <label><span>Display name</span><input autoFocus maxLength={80} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} placeholder="How people should see you" /></label>
          <label><span>Status text <em>Optional</em></span><input maxLength={120} value={value.statusText} onChange={(event) => onChange({ ...value, statusText: event.target.value })} placeholder="What are you working on?" /></label>
          <p className="onboarding-field-note">A generated Picom avatar is assigned once. You can replace it later in Profile settings.</p>
        </div>
      </div>
    </section>
  );
}
