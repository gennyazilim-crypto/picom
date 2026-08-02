import { useEffect, useMemo, useRef, useState } from "react";
import type { Member } from "../../types/community";
import type { ThemeMode } from "../../services/settingsService";
import type { OnboardingCompletion, OnboardingProfileBasics, OnboardingStartChoice } from "../../types/onboarding";
import {
  normalizeFollowUserIds,
  onboardingDraftStore,
  onboardingService,
  type OnboardingErrorCode,
} from "../../services/onboarding/onboardingService";
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
  onSessionExpired?: () => void;
};

function formatFinishError(message: string, code?: OnboardingErrorCode): string {
  if (!import.meta.env.DEV || !code) return message;
  return `${message}\n${code}`;
}

export function OnboardingFlow({
  userId,
  initialDisplayName,
  initialUsername = "",
  initialStatusText = "Ready to explore Picom",
  initialFollowedUserIds,
  suggestions,
  theme,
  onThemeChange,
  onComplete,
  onSessionExpired,
}: Props) {
  const visibleSuggestions = isV1FeatureEnabled("friends") ? suggestions : [];
  const variant = useMemo(() => onboardingExperimentService.getVariant(userId), [userId]);
  const steps = useMemo(() => onboardingExperimentService.getSteps(variant), [variant]);
  const draft = useMemo(() => onboardingDraftStore.load(userId), [userId]);

  const [stepIndex, setStepIndex] = useState(() => {
    const restored = draft?.stepIndex ?? 0;
    return Math.min(Math.max(restored, 0), Math.max(steps.length - 1, 0));
  });
  const [profile, setProfile] = useState<OnboardingProfileBasics>(() => draft?.profile ?? {
    displayName: initialDisplayName,
    username: initialUsername,
    statusText: initialStatusText,
  });
  const [startChoice, setStartChoice] = useState<OnboardingStartChoice>(() => draft?.startChoice ?? "mentionFeed");
  const [inviteCode, setInviteCode] = useState(() => draft?.inviteCode ?? "");
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(() =>
    normalizeFollowUserIds(draft?.followedUserIds?.length ? draft.followedUserIds : initialFollowedUserIds),
  );
  const [saving, setSaving] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  const currentStep = steps[stepIndex] ?? steps[steps.length - 1];
  const canContinue = currentStep.id !== "profile" || profile.displayName.trim().length > 0;
  const canSkip = currentStep.id === "theme" || currentStep.id === "community" || currentStep.id === "follow";
  const selectedSuggestionCount = useMemo(
    () => visibleSuggestions.filter((member) => followedUserIds.includes(member.userId)).length,
    [followedUserIds, visibleSuggestions],
  );

  useEffect(() => {
    onboardingExperimentService.recordStarted(variant);
  }, [variant]);

  useEffect(() => {
    if (draft?.theme && draft.theme !== theme) {
      onThemeChange(draft.theme);
    }
  }, [userId]); // one-shot draft theme hydrate per user

  useEffect(() => {
    if (saving || succeeded) return;
    onboardingDraftStore.save(userId, {
      stepIndex,
      profile,
      startChoice,
      inviteCode,
      followedUserIds,
      theme,
    });
  }, [followedUserIds, inviteCode, profile, saving, startChoice, stepIndex, succeeded, theme, userId]);

  const advance = () => setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  const toggleFollow = (userIdToToggle: string) => {
    setFollowedUserIds((current) =>
      current.includes(userIdToToggle)
        ? current.filter((id) => id !== userIdToToggle)
        : normalizeFollowUserIds([...current, userIdToToggle]),
    );
  };
  const skip = () => {
    if (currentStep.id === "community") {
      setStartChoice("mentionFeed");
      setInviteCode("");
    }
    advance();
  };

  const finish = async () => {
    if (finishingRef.current || saving || succeeded) return;
    finishingRef.current = true;
    setSaving(true);
    setError(null);

    const completion: OnboardingCompletion = {
      profile: {
        displayName: profile.displayName.trim(),
        username: profile.username.trim(),
        statusText: profile.statusText.trim(),
      },
      startChoice,
      inviteCode: startChoice === "joinInvite" ? inviteCode.trim() : undefined,
      followedUserIds: normalizeFollowUserIds(followedUserIds),
      theme,
    };

    try {
      const result = await onboardingService.complete(userId, completion);
      if (!result.ok) {
        setError(formatFinishError(result.error, result.code));
        setSaving(false);
        finishingRef.current = false;
        if (result.sessionMissing) onSessionExpired?.();
        return;
      }

      onboardingDraftStore.clear(userId);
      onboardingExperimentService.recordCompleted(variant);
      setSucceeded(true);
      setSaving(false);
      await onComplete({
        ...completion,
        followedUserIds: result.data.followedUserIds,
      });
    } catch {
      setError(formatFinishError("Your setup could not be saved. Please try again.", "ONBOARDING_UNKNOWN"));
      setSaving(false);
      finishingRef.current = false;
    }
  };

  const finishLabel = succeeded ? "Done" : saving ? "Saving…" : "Finish";

  return (
    <main className="first-run-onboarding" aria-label="Picom first-run onboarding">
      <section className="onboarding-wizard" aria-live="polite">
        <aside className="onboarding-progress-panel">
          <div className="onboarding-brand-mark"><AppIcon name="home" size="xl" /></div>
          <div>
            <p className="eyebrow">Picom desktop</p>
            <h1>Make Picom yours</h1>
            <p>Five focused steps prepare your profile, theme, communities, and Mention Feed.</p>
          </div>
          <ol>
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "complete" : ""}`}
              >
                <span>{index < stepIndex ? "OK" : index + 1}</span>
                <strong>{step.label}</strong>
              </li>
            ))}
          </ol>
          <small>{stepIndex + 1} of {steps.length}</small>
        </aside>
        <div className="onboarding-content-panel">
          <div className="onboarding-step-body">
            {currentStep.id === "profile" ? <OnboardingStepProfile value={profile} onChange={setProfile} /> : null}
            {currentStep.id === "theme" ? <OnboardingStepTheme theme={theme} onChange={onThemeChange} /> : null}
            {currentStep.id === "community" ? (
              <OnboardingStepCommunity
                value={startChoice}
                inviteCode={inviteCode}
                onChange={setStartChoice}
                onInviteCodeChange={setInviteCode}
              />
            ) : null}
            {currentStep.id === "follow" ? (
              <OnboardingStepFollow
                suggestions={visibleSuggestions}
                followedUserIds={followedUserIds}
                onToggleFollow={toggleFollow}
              />
            ) : null}
            {currentStep.id === "finish" ? (
              <OnboardingStepFinish
                profile={profile}
                selectedSuggestionCount={selectedSuggestionCount}
                theme={theme}
                startChoice={startChoice}
              />
            ) : null}
          </div>
          {error ? (
            <p className="onboarding-error" role="alert" style={{ whiteSpace: "pre-line" }}>
              {error}
            </p>
          ) : null}
          <footer className="onboarding-footer">
            <button
              type="button"
              className="onboarding-secondary"
              disabled={stepIndex === 0 || saving || succeeded}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              Back
            </button>
            {canSkip ? (
              <button type="button" className="onboarding-secondary" disabled={saving || succeeded} onClick={skip}>
                Skip
              </button>
            ) : null}
            {currentStep.id === "finish" ? (
              <button
                type="button"
                className="onboarding-primary"
                disabled={saving || succeeded}
                aria-busy={saving}
                onClick={() => void finish()}
              >
                {saving ? <span className="onboarding-finish-spinner" aria-hidden="true" /> : null}
                {finishLabel} <AppIcon name="send" size="sm" />
              </button>
            ) : (
              <button
                type="button"
                className="onboarding-primary"
                disabled={!canContinue || saving}
                onClick={advance}
              >
                Next <AppIcon name="chevronRight" size="sm" />
              </button>
            )}
          </footer>
        </div>
      </section>
    </main>
  );
}
