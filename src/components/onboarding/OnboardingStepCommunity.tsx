import { AppIcon, type IconName } from "../AppIcon";
import type { OnboardingStartChoice } from "../../types/onboarding";

type Props = { value: OnboardingStartChoice; inviteCode: string; onChange: (value: OnboardingStartChoice) => void; onInviteCodeChange: (value: string) => void };
const choices: Array<{ id: OnboardingStartChoice; title: string; description: string; icon: IconName }> = [
  { id: "createCommunity", title: "Create a community", description: "Continue now and create a community from Picom later.", icon: "plus" },
  { id: "joinInvite", title: "Join with an invite", description: "Save an invite code for the community join flow.", icon: "users" },
  { id: "mentionFeed", title: "Continue without a community", description: "Start with Mention Feed and join a community when ready.", icon: "home" },
];

export function OnboardingStepCommunity({ value, inviteCode, onChange, onInviteCodeChange }: Props) {
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-community-title">
      <div className="onboarding-step-heading"><span className="onboarding-step-icon"><AppIcon name="hash" size="lg" /></span><div><p className="eyebrow">Community entry</p><h2 id="onboarding-community-title">Choose how to begin</h2><p>This choice is non-destructive. Community actions remain available after onboarding.</p></div></div>
      <div className="onboarding-choice-grid" role="radiogroup" aria-label="Choose a community entry option">
        {choices.map((choice) => <button key={choice.id} type="button" role="radio" aria-checked={value === choice.id} className={`onboarding-choice ${value === choice.id ? "selected" : ""}`} onClick={() => onChange(choice.id)}><span><AppIcon name={choice.icon} size="md" /></span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
      </div>
      {value === "joinInvite" ? <label className="onboarding-invite-field"><span>Invite code</span><input value={inviteCode} maxLength={128} onChange={(event) => onInviteCodeChange(event.target.value)} placeholder="Paste an invite code" /></label> : null}
    </section>
  );
}

