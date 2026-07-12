import { useEffect, useMemo, useState } from "react";
import type { Member } from "../../types/community";
import type { ThemeMode } from "../../services/settingsService";
import type { OnboardingCompletion, OnboardingProfileBasics, OnboardingStartChoice } from "../../types/onboarding";
import { onboardingService } from "../../services/onboarding/onboardingService";
import { onboardingExperimentService } from "../../services/onboarding/onboardingExperimentService";
import { AppIcon } from "../AppIcon";
import { OnboardingStepCommunity } from "./OnboardingStepCommunity";
import { OnboardingStepFinish } from "./OnboardingStepFinish";
import { OnboardingStepFollow } from "./OnboardingStepFollow";
import { OnboardingStepProfile } from "./OnboardingStepProfile";
import { OnboardingStepTheme } from "./OnboardingStepTheme";
import { isV1FeatureEnabled } from "../../config/v1ReleaseScope";

type Props = {
  userId: string;
  initialDisplayName: string;
  initialUsername?: string;
  initialStatusText?: string;
  initialFollowedUserIds: string[];
  suggestions: Member[];
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onComplete: (completion: OnboardingCompletion) => void | Promise<void>;
};

export function OnboardingFlow({ userId, initialDisplayName, initialUsername = "", initialStatusText = "Ready to explore Picom", initialFollowedUserIds, suggestions, theme, onThemeChange, onComplete }: Props) {
  const visibleSuggestions = isV1FeatureEnabled("friends") ? suggestions : [];
  const variant = useMemo(() => onboardingExperimentService.getVariant(userId), [userId]);
  const steps = useMemo(() => onboardingExperimentService.getSteps(variant), [variant]);
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfileBasics>({ displayName: initialDisplayName, username: initialUsername, statusText: initialStatusText });
  const [startChoice, setStartChoice] = useState<OnboardingStartChoice>("mentionFeed");
  const [inviteCode, setInviteCode] = useState("");
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(initialFollowedUserIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentStep = steps[stepIndex];
  const canContinue = currentStep.id !== "profile" || profile.displayName.trim().length > 0;
  const canSkip = currentStep.id === "theme" || currentStep.id === "community" || currentStep.id === "follow";
  const selectedSuggestionCount = useMemo(() => visibleSuggestions.filter((member) => followedUserIds.includes(member.userId)).length, [followedUserIds, visibleSuggestions]);
  useEffect(() => { onboardingExperimentService.recordStarted(variant); }, [variant]);

  const advance = () => setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  const toggleFollow = (userIdToToggle: string) => setFollowedUserIds((current) => current.includes(userIdToToggle) ? current.filter((id) => id !== userIdToToggle) : [...current, userIdToToggle]);
  const skip = () => {
    if (currentStep.id === "community") {
      setStartChoice("mentionFeed");
      setInviteCode("");
    }
    advance();
  };
  const finish = async () => {
    setSaving(true);
    setError(null);
    const completion: OnboardingCompletion = {
      profile: { displayName: profile.displayName.trim(), username: profile.username.trim(), statusText: profile.statusText.trim() },
      startChoice,
      inviteCode: startChoice === "joinInvite" ? inviteCode.trim() : undefined,
      followedUserIds,
      theme,
    };
    const result = await onboardingService.complete(userId, completion);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onboardingExperimentService.recordCompleted(variant);
    await onComplete(completion);
  };

  return (
    <main className="first-run-onboarding" aria-label="Picom first-run onboarding">
      <section className="onboarding-wizard" aria-live="polite">
        <aside className="onboarding-progress-panel">
          <div className="onboarding-brand-mark"><AppIcon name="home" size="xl" /></div>
          <div><p className="eyebrow">Picom desktop</p><h1>Make Picom yours</h1><p>Five focused steps prepare your profile, theme, communities, and Mention Feed.</p></div>
          <ol>{steps.map((step, index) => <li key={step.id} className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "complete" : ""}`}><span>{index < stepIndex ? "OK" : index + 1}</span><strong>{step.label}</strong></li>)}</ol>
          <small>{stepIndex + 1} of {steps.length}</small>
        </aside>
        <div className="onboarding-content-panel">
          <div className="onboarding-step-body">
            {currentStep.id === "profile" ? <OnboardingStepProfile value={profile} onChange={setProfile} /> : null}
            {currentStep.id === "theme" ? <OnboardingStepTheme theme={theme} onChange={onThemeChange} /> : null}
            {currentStep.id === "community" ? <OnboardingStepCommunity value={startChoice} inviteCode={inviteCode} onChange={setStartChoice} onInviteCodeChange={setInviteCode} /> : null}
            {currentStep.id === "follow" ? <OnboardingStepFollow suggestions={visibleSuggestions} followedUserIds={followedUserIds} onToggleFollow={toggleFollow} /> : null}
            {currentStep.id === "finish" ? <OnboardingStepFinish profile={profile} selectedSuggestionCount={selectedSuggestionCount} theme={theme} startChoice={startChoice} /> : null}
          </div>
          {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
          <footer className="onboarding-footer">
            <button type="button" className="onboarding-secondary" disabled={stepIndex === 0 || saving} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>Back</button>
            {canSkip ? <button type="button" className="onboarding-secondary" disabled={saving} onClick={skip}>Skip</button> : null}
            {currentStep.id === "finish" ? <button type="button" className="onboarding-primary" disabled={saving} onClick={() => void finish()}>{saving ? "Saving..." : "Finish"} <AppIcon name="send" size="sm" /></button> : <button type="button" className="onboarding-primary" disabled={!canContinue || saving} onClick={advance}>Next <AppIcon name="chevronRight" size="sm" /></button>}
          </footer>
        </div>
      </section>
    </main>
  );
}
