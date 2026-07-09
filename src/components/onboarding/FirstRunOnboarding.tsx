import { useMemo, useState } from "react";
import type { Member } from "../../types/community";
import type { ThemeMode } from "../../services/settingsService";
import type { OnboardingCompletion, OnboardingProfileBasics, OnboardingStartChoice, OnboardingStepId } from "../../types/onboarding";
import { onboardingService } from "../../services/onboarding/onboardingService";
import { AppIcon } from "../AppIcon";
import { OnboardingStepProfile } from "./OnboardingStepProfile";
import { OnboardingStepStart } from "./OnboardingStepStart";
import { OnboardingStepFollowSuggestions } from "./OnboardingStepFollowSuggestions";
import { OnboardingStepTheme } from "./OnboardingStepTheme";

type Props = { userId: string; initialDisplayName: string; initialStatusText?: string; initialFollowedUserIds: string[]; suggestions: Member[]; theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void; onComplete: (completion: OnboardingCompletion) => void | Promise<void> };
const steps: Array<{ id: OnboardingStepId; label: string }> = [
  { id: "welcome", label: "Welcome" }, { id: "profile", label: "Profile" }, { id: "start", label: "Start" }, { id: "follow", label: "Follow" }, { id: "theme", label: "Theme" }, { id: "finish", label: "Finish" },
];

export function FirstRunOnboarding({ userId, initialDisplayName, initialStatusText = "Ready to explore Picom", initialFollowedUserIds, suggestions, theme, onThemeChange, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfileBasics>({ displayName: initialDisplayName, statusText: initialStatusText });
  const [startChoice, setStartChoice] = useState<OnboardingStartChoice>("mentionFeed");
  const [inviteCode, setInviteCode] = useState("");
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(initialFollowedUserIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentStep = steps[stepIndex];
  const canContinue = currentStep.id !== "profile" || profile.displayName.trim().length > 0;
  const selectedSuggestionCount = useMemo(() => suggestions.filter((member) => followedUserIds.includes(member.userId)).length, [followedUserIds, suggestions]);

  const toggleFollow = (userIdToToggle: string) => setFollowedUserIds((current) => current.includes(userIdToToggle) ? current.filter((id) => id !== userIdToToggle) : [...current, userIdToToggle]);
  const finish = async () => {
    setSaving(true); setError(null);
    const completion: OnboardingCompletion = { profile: { displayName: profile.displayName.trim(), statusText: profile.statusText.trim() }, startChoice, inviteCode: startChoice === "joinInvite" ? inviteCode.trim() : undefined, followedUserIds, theme };
    const result = await onboardingService.complete(userId, completion);
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    await onComplete(completion);
  };

  return (
    <main className="first-run-onboarding" aria-label="Picom first-run onboarding">
      <section className="onboarding-wizard" aria-live="polite">
        <aside className="onboarding-progress-panel">
          <div className="onboarding-brand-mark"><AppIcon name="home" size="xl" /></div>
          <div><p className="eyebrow">Picom desktop</p><h1>Welcome aboard</h1><p>Six quick steps prepare your profile and feed without getting in your way.</p></div>
          <ol>{steps.map((step, index) => <li key={step.id} className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "complete" : ""}`}><span>{index < stepIndex ? "✓" : index + 1}</span><strong>{step.label}</strong></li>)}</ol>
          <small>{stepIndex + 1} of {steps.length}</small>
        </aside>
        <div className="onboarding-content-panel">
          <div className="onboarding-step-body">
            {currentStep.id === "welcome" ? <section className="onboarding-step onboarding-welcome" aria-labelledby="onboarding-welcome-title"><span className="onboarding-welcome-orb"><AppIcon name="home" size="xl" /></span><p className="eyebrow">A calmer place for communities</p><h2 id="onboarding-welcome-title">Set up your Picom workspace</h2><p>Complete your profile, choose a starting point, follow useful people, and select the theme that fits your desktop.</p><div className="onboarding-welcome-points"><span><AppIcon name="users" size="sm" /> Community-first</span><span><AppIcon name="bell" size="sm" /> Mention-focused</span><span><AppIcon name="lock" size="sm" /> Privacy-aware</span></div></section> : null}
            {currentStep.id === "profile" ? <OnboardingStepProfile value={profile} onChange={setProfile} /> : null}
            {currentStep.id === "start" ? <OnboardingStepStart value={startChoice} inviteCode={inviteCode} onChange={setStartChoice} onInviteCodeChange={setInviteCode} /> : null}
            {currentStep.id === "follow" ? <OnboardingStepFollowSuggestions suggestions={suggestions} followedUserIds={followedUserIds} onToggleFollow={toggleFollow} /> : null}
            {currentStep.id === "theme" ? <OnboardingStepTheme theme={theme} onChange={onThemeChange} /> : null}
            {currentStep.id === "finish" ? <section className="onboarding-step onboarding-finish" aria-labelledby="onboarding-finish-title"><span className="onboarding-welcome-orb success"><AppIcon name="send" size="xl" /></span><p className="eyebrow">Ready for desktop</p><h2 id="onboarding-finish-title">Your Picom setup is ready</h2><p>{profile.displayName || "Your profile"} will start with {selectedSuggestionCount} suggested people followed and the {theme} theme.</p><div className="onboarding-finish-summary"><span><strong>{selectedSuggestionCount}</strong> suggested follows</span><span><strong>{theme === "dark" ? "Dark" : "Light"}</strong> appearance</span><span><strong>{startChoice === "demoCommunity" ? "Community" : "Mention Feed"}</strong> destination</span></div></section> : null}
          </div>
          {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
          <footer className="onboarding-footer">
            <button type="button" className="onboarding-secondary" disabled={stepIndex === 0 || saving} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>Back</button>
            {currentStep.id === "finish" ? <button type="button" className="onboarding-primary" disabled={saving} onClick={() => void finish()}>{saving ? "Saving…" : "Enter Picom"} <AppIcon name="send" size="sm" /></button> : <button type="button" className="onboarding-primary" disabled={!canContinue} onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}>Continue <AppIcon name="chevronRight" size="sm" /></button>}
          </footer>
        </div>
      </section>
    </main>
  );
}
