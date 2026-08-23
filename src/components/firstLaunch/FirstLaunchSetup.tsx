import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { listUiLanguageMetadata, getUiLanguageMetadata, type UiLanguage } from "../../services/localization/uiLanguages";
import { settingsService, type AccessibilitySettings, type AppearanceSettings, type InterfaceScale, type NotificationSettings, type ThemePreference } from "../../services/settingsService";
import {
  type FirstLaunchOptionalStepId,
  type FirstLaunchPurposeId,
  type FirstLaunchSetupState,
  type FirstLaunchSetupStatePatch,
} from "../../services/firstLaunchSetupState";
import {
  FIRST_LAUNCH_STEP_IDS,
  FIRST_LAUNCH_STEP_REGISTRY,
  getFirstLaunchStep,
  getFirstLaunchStepNavigationStatus,
  type FirstLaunchStepIcon,
} from "../../services/firstLaunchSetupSteps";
import {
  getGuidedPlanProgress,
  getNextIncludedStep,
  getPreviousIncludedStep,
  resolveFirstLaunchPlan,
  withCurrentStepInPlan,
} from "../../services/firstLaunchPersonalization";
import { AppIcon, type IconName } from "../AppIcon";
import { FirstLaunchPage } from "./FirstLaunchPage";
import { FirstLaunchPersonalize } from "./FirstLaunchPersonalize";
import { AppearanceStudio } from "./AppearanceStudio";
import { FirstLaunchAudioSetup } from "./FirstLaunchAudioSetup";
import { FirstLaunchCameraSetup, type FirstLaunchCameraSetupSummary } from "./FirstLaunchCameraSetup";
import { FirstLaunchScreenSharePreflight, type FirstLaunchScreenShareSummary } from "./FirstLaunchScreenSharePreflight";
import { FirstLaunchDesktopBehaviorStudio } from "./FirstLaunchDesktopBehaviorStudio";
import { FirstLaunchNotificationsStudio } from "./FirstLaunchNotificationsStudio";
import { FirstLaunchPrivacySetup, type FirstLaunchPrivacySummary } from "./FirstLaunchPrivacySetup";
import { FirstLaunchReady } from "./FirstLaunchReady";
import { accountPrivacySetupService, scopePrivacyReadyStatus } from "../../services/privacy/accountPrivacySetupService";
import { firstLaunchPrivacyReadyKeys } from "../../services/privacy/firstLaunchPrivacyReady";
import { voiceDeviceService } from "../../services/voiceDeviceService";
import { desktopBehaviorService, type DesktopBehaviorPreferences } from "../../services/desktop/desktopBehaviorService";
import { notificationPolicyStateService, type NotificationPolicyState } from "../../services/notificationPolicyStateService";
import { notificationService, type NotificationRuntimeStatus } from "../../services/notificationService";
import { meetingPreJoinService } from "../../services/meeting/meetingPreJoinService";
import { resolveFirstLaunchReadyState } from "../../services/firstLaunchReadyState";
import { reviewFirstLaunchStep } from "../../services/firstLaunchReadyReview";
import { releaseFirstLaunchMediaResources } from "../../services/firstLaunchMediaCleanup";
import type { FirstProductActionId } from "../../services/firstLaunchProductActions";
import type { FirstLaunchStepId } from "../../services/firstLaunchSetupSteps";

type FirstLaunchSetupProps = {
  state: FirstLaunchSetupState;
  appearanceSettings: AppearanceSettings;
  accessibilitySettings: AccessibilitySettings;
  session: Readonly<{
    authenticated: boolean;
    accountId: string | null;
    legalAccepted: boolean;
    onboardingComplete: boolean;
  }>;
  onStateChange: (patch: FirstLaunchSetupStatePatch) => void;
  onThemeChange: (theme: ThemePreference) => void;
  onAppearanceChange: (partial: Partial<AppearanceSettings>) => void;
  onAccessibilityChange: (partial: Partial<AccessibilitySettings>) => void;
  onInterfaceScaleChange: (scale: InterfaceScale) => Promise<boolean>;
  onResetAppearance: () => Promise<boolean>;
  onSkip: (stepId: FirstLaunchOptionalStepId) => void;
  onComplete: (options?: Readonly<{ action?: FirstProductActionId }>) => Promise<{ ok: boolean }> | { ok: boolean };
};

const [welcomeStep, personalizeStep, appearanceStep, audioVideoStep, desktopStep, notificationsStep, privacyStep, readyStep] = FIRST_LAUNCH_STEP_REGISTRY;

function stepIcon(icon: FirstLaunchStepIcon): IconName {
  return icon;
}

export function FirstLaunchSetup({ state, appearanceSettings, accessibilitySettings, session, onStateChange, onThemeChange, onAppearanceChange, onAccessibilityChange, onInterfaceScaleChange, onResetAppearance, onSkip, onComplete }: FirstLaunchSetupProps) {
  const { t } = useTranslation("firstLaunch");
  const languages = useMemo(() => listUiLanguageMetadata(), []);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [mediaSummary, setMediaSummary] = useState<Readonly<{
    camera: FirstLaunchCameraSetupSummary;
    screen: FirstLaunchScreenShareSummary;
  }>>({
    camera: { attempted: false, passed: false, skipped: false },
    screen: { attempted: false, passed: false, skipped: false, blocked: false, unavailable: false },
  });
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopBehaviorPreferences>(() => desktopBehaviorService.getState());
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [notificationPolicy, setNotificationPolicy] = useState<NotificationPolicyState>(() => notificationPolicyStateService.getSnapshot());
  const [notificationStatus, setNotificationStatus] = useState<NotificationRuntimeStatus>(() => notificationService.getStatus());
  const [privacySummary, setPrivacySummary] = useState<FirstLaunchPrivacySummary | null>(null);
  const [audioSnapshot, setAudioSnapshot] = useState(() => voiceDeviceService.getSnapshot());
  const [cameraSnapshot, setCameraSnapshot] = useState(() => meetingPreJoinService.getSnapshot());
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const derivedPlan = useMemo(
    () => resolveFirstLaunchPlan({ selectedPurposeIds: state.purposeIds, reviewAllSetup: state.reviewAllSetup }),
    [state.purposeIds, state.reviewAllSetup],
  );
  const activePlan = useMemo(
    () => withCurrentStepInPlan(derivedPlan, state.currentStep),
    [derivedPlan, state.currentStep],
  );
  const current = getFirstLaunchStep(state.currentStep) ?? FIRST_LAUNCH_STEP_REGISTRY[0];
  const next = getNextIncludedStep(current.id, activePlan.includedStepIds);
  const previous = getPreviousIncludedStep(current.id, activePlan.includedStepIds);
  const guidedProgress = getGuidedPlanProgress(current.id, activePlan.includedStepIds);
  const stepPosition = guidedProgress.current;
  const totalSteps = guidedProgress.total;
  const omittedByPlan = derivedPlan.omittedOptionalStepIds;
  const purposeSummary = state.purposeIds.map((purposeId) => t(`personalize.purposes.${purposeId}.title`)).join(t("personalize.purposeJoin"));

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.currentStep]);

  useEffect(() => () => { releaseFirstLaunchMediaResources(); }, []);
  useEffect(() => {
    const unsubscribe = voiceDeviceService.subscribe(setAudioSnapshot);
    return () => { unsubscribe(); };
  }, []);
  useEffect(() => {
    const unsubscribe = meetingPreJoinService.subscribe(() => setCameraSnapshot(meetingPreJoinService.getSnapshot()));
    return () => { unsubscribe(); };
  }, []);
  useEffect(() => {
    const unsubscribe = desktopBehaviorService.subscribe(setDesktopPreferences);
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribeSettings = settingsService.subscribe((next) => setNotificationSettings(next.notificationSettings));
    const unsubscribePolicy = notificationPolicyStateService.subscribe(setNotificationPolicy);
    return () => {
      unsubscribeSettings();
      unsubscribePolicy();
    };
  }, []);

  useEffect(() => {
    if (current.id !== "desktop" && current.id !== "ready") return;
    void desktopBehaviorService.refresh().then(setDesktopPreferences);
  }, [current.id]);

  useEffect(() => {
    if (current.id !== "notifications" && current.id !== "ready") return;
    void notificationService.refreshStatus().then(setNotificationStatus);
  }, [current.id]);

  useEffect(() => {
    if (current.id !== "ready" || state.skippedStepIds.includes("privacy") || omittedByPlan.includes("privacy")) return;
    let cancelled = false;
    void accountPrivacySetupService.hydrate().then((result) => {
      if (!cancelled) setPrivacySummary(result);
    });
    return () => { cancelled = true; };
  }, [current.id, omittedByPlan, session.accountId, state.skippedStepIds]);

  const goTo = (stepId: typeof current.id) => onStateChange({ currentStep: stepId });
  const continueToNext = () => {
    if (next) goTo(next.id);
  };
  const togglePurpose = (purposeId: FirstLaunchPurposeId) => {
    const selected = state.purposeIds.includes(purposeId);
    onStateChange({
      purposeIds: selected
        ? state.purposeIds.filter((item) => item !== purposeId)
        : [...state.purposeIds, purposeId],
    });
  };
  const progressLabel = t("progress.step", { current: stepPosition, total: totalSteps });
  const areasLabel = t("progress.areas", { shown: activePlan.includedStepIds.length, total: FIRST_LAUNCH_STEP_IDS.length });
  const scopedPrivacySummary = scopePrivacyReadyStatus(privacySummary, session.accountId);
  const privacyKeys = scopedPrivacySummary?.status === "ready" ? firstLaunchPrivacyReadyKeys(scopedPrivacySummary.snapshot) : undefined;
  const readyState = useMemo(() => resolveFirstLaunchReadyState({
    locale: state.locale,
    theme: appearanceSettings.themeMode,
    density: appearanceSettings.density,
    textSize: accessibilitySettings.textSize,
    interfaceScale: accessibilitySettings.interfaceScale,
    reducedMotion: accessibilitySettings.reducedMotion,
    highContrast: accessibilitySettings.highContrast,
    focusRingStrong: accessibilitySettings.focusRingStrong,
    purposeIds: state.purposeIds,
    reviewAllSetup: state.reviewAllSetup,
    skippedStepIds: state.skippedStepIds,
    audio: {
      permission: audioSnapshot.permission,
      setupStatus: audioSnapshot.setupStatus,
      selectedInputId: audioSnapshot.selectedInputId,
      selectedOutputId: audioSnapshot.selectedOutputId,
      inputPresent: audioSnapshot.inputDevices.some((device) => device.deviceId === audioSnapshot.selectedInputId),
      outputPresent: audioSnapshot.outputDevices.some((device) => device.deviceId === audioSnapshot.selectedOutputId),
      microphoneTestPassed: audioSnapshot.microphoneTestPassed,
      microphoneTestAttempted: audioSnapshot.microphoneTestAttempted,
    },
    camera: {
      permission: cameraSnapshot.cameraPermission,
      selectedPresent: cameraSnapshot.cameras.some((device) => device.deviceId === cameraSnapshot.selectedCameraId),
      previewActive: cameraSnapshot.cameraPreviewActive,
      attempted: mediaSummary.camera.attempted,
      passed: mediaSummary.camera.passed,
      skipped: mediaSummary.camera.skipped,
      errorCode: cameraSnapshot.error?.code ?? null,
    },
    screen: {
      attempted: mediaSummary.screen.attempted,
      passed: mediaSummary.screen.passed,
      skipped: mediaSummary.screen.skipped,
      blocked: mediaSummary.screen.blocked === true,
      unavailable: mediaSummary.screen.unavailable === true,
    },
    desktop: {
      launchAtStartup: desktopPreferences.launchAtStartup,
      startupVisibility: desktopPreferences.startupVisibility,
      closeBehavior: desktopPreferences.closeBehavior,
      startupDestination: desktopPreferences.startupDestination,
      startupCapability: desktopPreferences.startupCapability,
    },
    notifications: {
      capability: notificationStatus.capability,
      quietHoursEnabled: notificationSettings.quietHours.enabled,
      quietHoursRange: `${notificationSettings.quietHours.startTime}–${notificationSettings.quietHours.endTime}`,
      doNotDisturb: notificationPolicy.doNotDisturb,
    },
    privacy: {
      status: scopedPrivacySummary?.status ?? (session.authenticated ? "loading" : "anonymous"),
      friendRequestKey: privacyKeys?.friendRequestKey,
      directMessageKey: privacyKeys?.directMessageKey,
      profileKey: privacyKeys?.profileKey,
      presenceKey: privacyKeys?.presenceKey,
    },
    session,
  }), [
    accessibilitySettings.focusRingStrong,
    accessibilitySettings.highContrast,
    accessibilitySettings.interfaceScale,
    accessibilitySettings.reducedMotion,
    accessibilitySettings.textSize,
    appearanceSettings.density,
    appearanceSettings.themeMode,
    audioSnapshot,
    cameraSnapshot,
    desktopPreferences,
    mediaSummary,
    notificationPolicy.doNotDisturb,
    notificationSettings.quietHours.enabled,
    notificationSettings.quietHours.endTime,
    notificationSettings.quietHours.startTime,
    notificationStatus.capability,
    privacyKeys,
    scopedPrivacySummary,
    session,
    state.locale,
    state.purposeIds,
    state.reviewAllSetup,
    state.skippedStepIds,
  ]);

  const reviewStep = (stepId: FirstLaunchStepId) => {
    onStateChange(reviewFirstLaunchStep(state, stepId));
  };

  const finishReady = async (action?: FirstProductActionId) => {
    if (!readyState.canComplete || completing) return;
    setCompleting(true);
    setCompletionError(false);
    const result = await onComplete(action ? { action } : undefined);
    if (!result.ok) {
      setCompletionError(true);
      setCompleting(false);
    }
  };
  const stepContent = {
    [welcomeStep.renderKey]: <FirstLaunchPage id="first-launch-welcome" eyebrow={t("welcome.eyebrow")} title={t("welcome.title")} description={t("welcome.body")} headingRef={headingRef} aside={<ProductPreview t={t} />}>
      <div className="first-launch-capability-list">
        <Capability icon="users" title={t("welcome.communities.title")} body={t("welcome.communities.body")} />
        <Capability icon="voice" title={t("welcome.communication.title")} body={t("welcome.communication.body")} />
        <Capability icon="settings" title={t("welcome.desktop.title")} body={t("welcome.desktop.body")} />
      </div>
    </FirstLaunchPage>,
    [personalizeStep.renderKey]: <FirstLaunchPage id="first-launch-personalize" eyebrow={t("personalize.eyebrow")} title={t("personalize.title")} description={t("personalize.body")} headingRef={headingRef} helper={t("personalize.helper")}>
      <FirstLaunchPersonalize
        selectedPurposeIds={state.purposeIds}
        reviewAllSetup={state.reviewAllSetup}
        plan={derivedPlan}
        t={t}
        onTogglePurpose={togglePurpose}
        onReviewAllChange={(enabled) => onStateChange({ reviewAllSetup: enabled })}
      />
    </FirstLaunchPage>,
    [appearanceStep.renderKey]: <FirstLaunchPage id="first-launch-appearance" eyebrow={t("appearance.eyebrow")} title={t("appearance.title")} description={t("appearance.body")} headingRef={headingRef}>
      <AppearanceStudio appearanceSettings={appearanceSettings} accessibilitySettings={accessibilitySettings} onThemeChange={onThemeChange} onAppearanceChange={onAppearanceChange} onAccessibilityChange={onAccessibilityChange} onInterfaceScaleChange={onInterfaceScaleChange} onResetAppearance={onResetAppearance} />
    </FirstLaunchPage>,
    [audioVideoStep.renderKey]: <FirstLaunchPage id="first-launch-audio-video" eyebrow={t("audioVideo.eyebrow")} title={t("audioVideo.title")} description={t("audioVideo.body")} headingRef={headingRef}>
      <div className="first-launch-media-setup">
        <FirstLaunchAudioSetup />
        <FirstLaunchCameraSetup onSummaryChange={(camera) => setMediaSummary((current) => ({ ...current, camera }))} />
        <FirstLaunchScreenSharePreflight onSummaryChange={(screen) => setMediaSummary((current) => ({ ...current, screen }))} />
      </div>
    </FirstLaunchPage>,
    [desktopStep.renderKey]: <FirstLaunchPage id="first-launch-desktop" eyebrow={t("desktop.eyebrow")} title={t("desktop.title")} description={t("desktop.body")} headingRef={headingRef}>
      <FirstLaunchDesktopBehaviorStudio preferences={desktopPreferences} />
    </FirstLaunchPage>,
    [notificationsStep.renderKey]: <FirstLaunchPage id="first-launch-notifications" eyebrow={t("notifications.eyebrow")} title={t("notifications.title")} description={t("notifications.body")} headingRef={headingRef}>
      <FirstLaunchNotificationsStudio />
    </FirstLaunchPage>,
    [privacyStep.renderKey]: <FirstLaunchPage id="first-launch-privacy" eyebrow={t("privacy.eyebrow")} title={t("privacy.title")} description={t("privacy.body")} headingRef={headingRef}>
      <FirstLaunchPrivacySetup t={t} onSummaryChange={setPrivacySummary} />
    </FirstLaunchPage>,
    [readyStep.renderKey]: <FirstLaunchPage id="first-launch-ready" eyebrow={t("ready.eyebrow")} title={t("ready.title")} description={t("ready.body")} headingRef={headingRef}>
      <FirstLaunchReady
        ready={readyState}
        t={t}
        languageLabel={getUiLanguageMetadata(state.locale).nativeLabel}
        completing={completing}
        completionError={completionError}
        onReview={reviewStep}
        onReviewAll={() => onStateChange({ reviewAllSetup: true })}
        onProductAction={(action) => { void finishReady(action); }}
      />
    </FirstLaunchPage>,
  } as const;

  return (
    <main className="first-launch-setup" aria-label={t("setupLabel")}>
      <section className="first-launch-frame">
        <aside className="first-launch-rail" aria-label={t("desktopSetup")}>
          <div className="first-launch-brand"><span className="first-launch-brand-mark" aria-hidden="true">P</span><div><strong>PICOM</strong><small>{t("desktopSetup")}</small></div></div>
          <nav aria-label={t("stepNavigationLabel")}>
            <ol className="first-launch-step-list">
              {activePlan.includedStepIds.map((stepId, index) => {
                const step = getFirstLaunchStep(stepId);
                if (!step) return null;
                const isCurrent = step.id === current.id;
                const status = getFirstLaunchStepNavigationStatus(step.id, current.id, state.skippedStepIds, activePlan.includedStepIds);
                const skipped = status === "skipped";
                const completed = status === "completed";
                return <li key={step.id} className={`is-${status}`}>
                  <span className="first-launch-step-marker" aria-hidden="true">{completed ? "✓" : index + 1}</span>
                  <div>
                    <strong aria-current={isCurrent ? "step" : undefined}>{String(index + 1).padStart(2, "0")} {t(step.labelKey)}</strong>
                    <small>{isCurrent ? t("state.current") : skipped ? t("state.skipped") : completed ? t("state.completed") : step.optional ? t("state.optional") : t("state.upcoming")}</small>
                  </div>
                </li>;
              })}
            </ol>
          </nav>
          <div className="first-launch-rail-progress">
            <span>{progressLabel}</span>
            <small>{areasLabel}</small>
            {state.purposeIds.length ? <small>{t("personalize.tailoredFor", { purposes: purposeSummary })}</small> : null}
            <div className="first-launch-progress" role="progressbar" aria-label={t("progress.label")} aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepPosition} aria-valuetext={progressLabel}>
              <span style={{ width: `${(stepPosition / totalSteps) * 100}%` }} />
            </div>
            <label className="first-launch-rail-review-all">
              <input type="checkbox" checked={state.reviewAllSetup} onChange={(event) => onStateChange({ reviewAllSetup: event.target.checked })} />
              <span>{t("personalize.reviewAll")}</span>
            </label>
          </div>
        </aside>

        <div className="first-launch-content">
          <header className="first-launch-compact-header">
            <div><strong>{progressLabel}</strong><span>{t(current.labelKey)}</span></div>
            <small>{areasLabel}</small>
            <div className="first-launch-progress" role="progressbar" aria-label={t("progress.label")} aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepPosition} aria-valuetext={progressLabel}><span style={{ width: `${(stepPosition / totalSteps) * 100}%` }} /></div>
          </header>
          <label className="first-launch-locale-toggle">
            <span className="sr-only">{t("languageLabel")}</span>
            <select value={state.locale} onChange={(event) => onStateChange({ locale: event.target.value as UiLanguage })} aria-label={t("languageLabel")}>
              {languages.map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}
            </select>
          </label>
          <div className="sr-only" role="status" aria-live="polite">{progressLabel}: {t(current.labelKey)}</div>

          {stepContent[current.renderKey]}

          <footer className="first-launch-actions" aria-label={t("navigationLabel")}>
            <button type="button" className="secondary" disabled={!previous || completing} onClick={() => previous && goTo(previous.id)}>{t("actions.back")}</button>
            <div className="first-launch-action-group">
              {current.canSkip ? <button type="button" className="secondary" disabled={completing} onClick={() => onSkip(current.id as FirstLaunchOptionalStepId)}>{t("actions.skipForNow")}</button> : null}
              {!next
                ? <button type="button" className="primary" disabled={completing || !readyState.canComplete} onClick={() => { void finishReady(); }}>{t(readyState.primaryCtaKey)} <AppIcon name="chevronRight" size="sm" /></button>
                : <button type="button" className="primary" onClick={continueToNext}>{t("actions.continue")} <AppIcon name="chevronRight" size="sm" /></button>}
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

function Capability({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return <article className="first-launch-capability"><span><AppIcon name={icon} size="lg" /></span><div><strong>{title}</strong><p>{body}</p></div></article>;
}

function ProductPreview({ t }: { t: (key: string) => string }) {
  return <div className="first-launch-product-preview" aria-label={t("welcome.previewLabel")}><header><span aria-hidden="true">P</span><strong>{t("welcome.previewTitle")}</strong><i /></header><div><aside><span>{t("welcome.previewCommunities")}</span><span>{t("welcome.previewMessages")}</span></aside><section><strong>{t("welcome.previewConversation")}</strong><p>{t("welcome.previewMessage")}</p><p>{t("welcome.previewReply")}</p></section></div></div>;
}
