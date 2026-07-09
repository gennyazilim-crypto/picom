import { AppIcon, type IconName } from "../AppIcon";
import type { OnboardingStartChoice } from "../../types/onboarding";

type Props = { value: OnboardingStartChoice; inviteCode: string; onChange: (value: OnboardingStartChoice) => void; onInviteCodeChange: (value: string) => void };
const choices: Array<{ id: OnboardingStartChoice; title: string; description: string; icon: IconName }> = [
  { id: "createCommunity", title: "Create a community", description: "Open the community creator after setup.", icon: "plus" },
  { id: "joinInvite", title: "Join with an invite", description: "Prepare an invite code for the join flow.", icon: "users" },
  { id: "mentionFeed", title: "Continue to Mention Feed", description: "See updates and mentions from people you follow.", icon: "home" },
  { id: "demoCommunity", title: "Explore the demo community", description: "Start in the local Picom workspace.", icon: "hash" },
];

export function OnboardingStepStart({ value, inviteCode, onChange, onInviteCodeChange }: Props) {
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-start-title">
      <div className="onboarding-step-heading"><span className="onboarding-step-icon"><AppIcon name="home" size="lg" /></span><div><p className="eyebrow">Start point</p><h2 id="onboarding-start-title">Where should Picom take you?</h2><p>Choose a first destination. Every option remains available later.</p></div></div>
      <div className="onboarding-choice-grid" role="radiogroup" aria-label="Choose a first destination">
        {choices.map((choice) => <button key={choice.id} type="button" role="radio" aria-checked={value === choice.id} className={`onboarding-choice ${value === choice.id ? "selected" : ""}`} onClick={() => onChange(choice.id)}><span><AppIcon name={choice.icon} size="md" /></span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
      </div>
      {value === "joinInvite" ? <label className="onboarding-invite-field"><span>Invite code</span><input value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value)} placeholder="Paste an invite code" /></label> : null}
    </section>
  );
}
