import type { ThemeMode } from "../../services/settingsService";
import type { OnboardingProfileBasics, OnboardingStartChoice } from "../../types/onboarding";
import { AppIcon } from "../AppIcon";

type Props = { profile: OnboardingProfileBasics; selectedSuggestionCount: number; theme: ThemeMode; startChoice: OnboardingStartChoice };
const destinationLabels: Record<OnboardingStartChoice, string> = { createCommunity: "Create later", joinInvite: "Invite prepared", mentionFeed: "Mention Feed" };

export function OnboardingStepFinish({ profile, selectedSuggestionCount, theme, startChoice }: Props) {
  return (
    <section className="onboarding-step onboarding-finish" aria-labelledby="onboarding-finish-title">
      <span className="onboarding-welcome-orb success"><AppIcon name="send" size="xl" /></span>
      <p className="eyebrow">Ready for desktop</p>
      <h2 id="onboarding-finish-title">Your Picom setup is ready</h2>
      <p>{profile.displayName || "Your profile"} will open in Mention Feed with the choices below.</p>
      <div className="onboarding-finish-summary"><span><strong>{selectedSuggestionCount}</strong> suggested follows</span><span><strong>{theme === "dark" ? "Dark" : "Light"}</strong> appearance</span><span><strong>{destinationLabels[startChoice]}</strong> community choice</span></div>
    </section>
  );
}
