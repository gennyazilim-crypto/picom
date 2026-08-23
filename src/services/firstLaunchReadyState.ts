import { isUiLanguage, type UiLanguage } from "./localization/uiLanguages.ts";
import {
  resolveFirstLaunchPlan,
  type FirstLaunchPlan,
  type FirstLaunchPurposeId,
} from "./firstLaunchPersonalization.ts";
import {
  defaultFirstProductActionCapabilities,
  FIRST_PRODUCT_ACTION_MODE,
  resolveFirstProductActions,
  type FirstProductAction,
  type FirstProductActionCapability,
} from "./firstLaunchProductActions.ts";
import type { FirstLaunchOptionalStepId, FirstLaunchStepId } from "./firstLaunchSetupSteps.ts";
import type { ThemePreference } from "./settingsService.ts";

/**
 * READY COMPLETION BLOCKER POLICY:
 * OPTIONAL_STEPS_NEVER_BLOCK. Completion is blocked only when required
 * Appearance locale/theme cannot be represented in canonical first-launch state.
 * Camera denied, microphone skipped, notifications blocked, and deferred
 * privacy never block device first-run completion.
 */
export const READY_COMPLETION_BLOCKER_POLICY = "OPTIONAL_STEPS_NEVER_BLOCK" as const;

export type FirstLaunchReadyStatus =
  | "configured"
  | "tested"
  | "not-tested"
  | "skipped"
  | "deferred"
  | "unavailable"
  | "blocked"
  | "not-in-plan";

export type FirstLaunchReadySeverity = "positive" | "neutral" | "attention";
export type FirstLaunchReadySectionId = "appearance" | "audio-video" | "desktop" | "notifications" | "privacy";
export type FirstLaunchNextGate = "sign-in" | "legal" | "account-onboarding" | "enter-picom";

export type FirstLaunchReadyRow = Readonly<{
  id: string;
  sectionId: FirstLaunchReadySectionId;
  labelKey: string;
  valueKey?: string;
  valueParams?: Readonly<Record<string, string | number>>;
  valueText?: string;
  status: FirstLaunchReadyStatus;
  severity: FirstLaunchReadySeverity;
  reviewStepId?: FirstLaunchStepId;
  reviewLabelKey?: string;
}>;

export type FirstLaunchReadySection = Readonly<{
  id: FirstLaunchReadySectionId;
  labelKey: string;
  participation: "included" | "skipped" | "omitted";
  rows: readonly FirstLaunchReadyRow[];
}>;

export type FirstLaunchReadyBlocker = Readonly<{
  code: "locale" | "theme";
  messageKey: string;
}>;

export type FirstLaunchReadyAudioSnapshot = Readonly<{
  permission: "prompt" | "granted" | "denied" | "unsupported";
  setupStatus: "unknown" | "prompt" | "requesting" | "granted" | "denied" | "unavailable" | "error" | "unsupported";
  selectedInputId: string;
  selectedOutputId: string;
  inputPresent: boolean;
  outputPresent: boolean;
  microphoneTestPassed: boolean;
  microphoneTestAttempted: boolean;
}>;

export type FirstLaunchReadyCameraSnapshot = Readonly<{
  permission: "prompt" | "granted" | "denied" | "unsupported" | "unknown";
  selectedPresent: boolean;
  previewActive: boolean;
  attempted: boolean;
  passed: boolean;
  skipped: boolean;
  errorCode?: string | null;
}>;

export type FirstLaunchReadyScreenSnapshot = Readonly<{
  attempted: boolean;
  passed: boolean;
  skipped: boolean;
  blocked: boolean;
  unavailable: boolean;
}>;

export type FirstLaunchReadyDesktopSnapshot = Readonly<{
  launchAtStartup: boolean;
  startupVisibility: "normal" | "tray";
  closeBehavior: "tray" | "quit";
  startupDestination: "last" | "feed" | "messages" | "communities";
  startupCapability: "supported" | "dev-unavailable" | "unsupported" | "unavailable";
}>;

export type FirstLaunchReadyNotificationSnapshot = Readonly<{
  capability: string;
  quietHoursEnabled: boolean;
  quietHoursRange?: string;
  doNotDisturb: boolean;
}>;

export type FirstLaunchReadyPrivacySnapshot = Readonly<{
  status: "anonymous" | "ready" | "unavailable" | "loading" | "skipped" | null;
  friendRequestKey?: string;
  directMessageKey?: string;
  profileKey?: string;
  presenceKey?: string;
}>;

export type FirstLaunchReadyInput = Readonly<{
  locale: UiLanguage | string;
  theme: ThemePreference | string;
  density: "comfortable" | "compact";
  textSize: "default" | "large" | "extra-large";
  interfaceScale?: number;
  reducedMotion?: boolean;
  highContrast?: boolean;
  focusRingStrong?: boolean;
  purposeIds?: readonly FirstLaunchPurposeId[];
  reviewAllSetup?: boolean;
  skippedStepIds?: readonly FirstLaunchOptionalStepId[];
  audio: FirstLaunchReadyAudioSnapshot;
  camera: FirstLaunchReadyCameraSnapshot;
  screen: FirstLaunchReadyScreenSnapshot;
  desktop: FirstLaunchReadyDesktopSnapshot;
  notifications: FirstLaunchReadyNotificationSnapshot;
  privacy: FirstLaunchReadyPrivacySnapshot;
  session: Readonly<{
    authenticated: boolean;
    legalAccepted: boolean;
    onboardingComplete: boolean;
  }>;
  capabilities?: Partial<FirstProductActionCapability>;
}>;

export type FirstLaunchReadyState = Readonly<{
  plan: FirstLaunchPlan;
  sections: readonly FirstLaunchReadySection[];
  omittedSectionIds: readonly FirstLaunchReadySectionId[];
  canComplete: boolean;
  blockers: readonly FirstLaunchReadyBlocker[];
  nextGate: FirstLaunchNextGate;
  primaryCtaKey: "ready.continueSignIn" | "ready.continueSetup" | "ready.enterPicom";
  showProductActions: boolean;
  productActions: readonly FirstProductAction[];
  actionMode: typeof FIRST_PRODUCT_ACTION_MODE;
}>;

function severityFor(status: FirstLaunchReadyStatus): FirstLaunchReadySeverity {
  if (status === "configured" || status === "tested") return "positive";
  if (status === "blocked" || status === "unavailable") return "attention";
  return "neutral";
}

function row(
  partial: Omit<FirstLaunchReadyRow, "severity"> & Partial<Pick<FirstLaunchReadyRow, "severity">>,
): FirstLaunchReadyRow {
  return { severity: partial.severity ?? severityFor(partial.status), ...partial };
}

function participation(
  stepId: FirstLaunchOptionalStepId,
  plan: FirstLaunchPlan,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
): "included" | "skipped" | "omitted" {
  if (!plan.includedStepIds.includes(stepId)) return "omitted";
  if (skippedStepIds.includes(stepId)) return "skipped";
  return "included";
}

function notificationStatus(capability: string): { status: FirstLaunchReadyStatus; valueKey: string } {
  if (capability === "native-available" || capability === "browser-granted") {
    return { status: "configured", valueKey: "notifications.statusAvailable" };
  }
  if (capability === "browser-blocked") return { status: "blocked", valueKey: "notifications.statusBlocked" };
  if (capability === "native-unsupported" || capability === "unsupported") {
    return { status: "unavailable", valueKey: "notifications.statusUnsupported" };
  }
  if (capability === "browser-permission-required") {
    return { status: "not-tested", valueKey: "notifications.statusPermissionRequired" };
  }
  if (capability === "native-checking") return { status: "configured", valueKey: "notifications.statusChecking" };
  return { status: "unavailable", valueKey: "notifications.statusUnavailable" };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveFirstLaunchCompletionBlockers(input: Pick<FirstLaunchReadyInput, "locale" | "theme">): readonly FirstLaunchReadyBlocker[] {
  const blockers: FirstLaunchReadyBlocker[] = [];
  if (!isUiLanguage(input.locale)) blockers.push({ code: "locale", messageKey: "ready.error.save" });
  if (!isThemePreference(input.theme)) blockers.push({ code: "theme", messageKey: "ready.error.save" });
  return blockers;
}

export function resolveFirstLaunchNextGate(session: FirstLaunchReadyInput["session"]): FirstLaunchNextGate {
  if (!session.authenticated) return "sign-in";
  if (!session.legalAccepted) return "legal";
  if (!session.onboardingComplete) return "account-onboarding";
  return "enter-picom";
}

function appearanceSection(input: FirstLaunchReadyInput): FirstLaunchReadySection {
  const scale = typeof input.interfaceScale === "number" ? Math.round(input.interfaceScale * 100) : null;
  const rows: FirstLaunchReadyRow[] = [
    row({ id: "language", sectionId: "appearance", labelKey: "ready.language", valueText: String(input.locale), status: "configured", reviewStepId: "appearance", reviewLabelKey: "ready.reviewAppearance" }),
    row({ id: "theme", sectionId: "appearance", labelKey: "ready.theme", valueKey: `theme.${isThemePreference(input.theme) ? input.theme : "system"}`, status: "configured", reviewStepId: "appearance", reviewLabelKey: "ready.reviewAppearance" }),
    row({ id: "density", sectionId: "appearance", labelKey: "ready.density", valueKey: `appearance.${input.density}`, status: "configured", reviewStepId: "appearance", reviewLabelKey: "ready.reviewAppearance" }),
    row({ id: "textSize", sectionId: "appearance", labelKey: "ready.textSize", valueKey: `appearance.textSize.${input.textSize}`, status: "configured", reviewStepId: "appearance", reviewLabelKey: "ready.reviewAppearance" }),
  ];
  if (scale === 90 || scale === 100 || scale === 110 || scale === 125) {
    rows.push(row({ id: "interfaceScale", sectionId: "appearance", labelKey: "ready.interfaceScale", valueKey: `appearance.interfaceScale.${scale}`, status: "configured", reviewStepId: "appearance", reviewLabelKey: "ready.reviewAppearance" }));
  }
  return { id: "appearance", labelKey: "steps.appearance", participation: "included", rows };
}

function audioSection(
  input: FirstLaunchReadyInput,
  plan: FirstLaunchPlan,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
): FirstLaunchReadySection {
  const state = participation("audio-video", plan, skippedStepIds);
  if (state === "omitted") {
    return {
      id: "audio-video",
      labelKey: "steps.audioVideo",
      participation: "omitted",
      rows: [row({ id: "audio-omitted", sectionId: "audio-video", labelKey: "steps.audioVideo", valueKey: "ready.notIncluded", status: "not-in-plan", reviewStepId: "audio-video", reviewLabelKey: "ready.configureAudio" })],
    };
  }
  if (state === "skipped") {
    return {
      id: "audio-video",
      labelKey: "steps.audioVideo",
      participation: "skipped",
      rows: [row({ id: "audio-skipped", sectionId: "audio-video", labelKey: "steps.audioVideo", valueKey: "ready.status.skipped", status: "skipped", reviewStepId: "audio-video", reviewLabelKey: "ready.reviewAudio" })],
    };
  }

  const micStatus: FirstLaunchReadyStatus = input.audio.permission === "denied" || input.audio.setupStatus === "denied"
    ? "blocked"
    : input.audio.setupStatus === "unavailable" || input.audio.setupStatus === "unsupported" || !input.audio.inputPresent
      ? "unavailable"
      : input.audio.microphoneTestPassed && input.audio.inputPresent
        ? "tested"
        : input.audio.permission === "granted" && input.audio.inputPresent
          ? "configured"
          : "not-tested";
  const speakerStatus: FirstLaunchReadyStatus = !input.audio.outputPresent
    ? "unavailable"
    : input.audio.selectedOutputId
      ? "configured"
      : "not-tested";
  const cameraStatus: FirstLaunchReadyStatus = input.camera.skipped
    ? "skipped"
    : input.camera.permission === "denied" || input.camera.errorCode === "CAMERA_DENIED"
      ? "blocked"
      : input.camera.errorCode === "CAMERA_MISSING" || (!input.camera.selectedPresent && (input.camera.attempted || input.camera.passed))
        ? "unavailable"
        : input.camera.previewActive && input.camera.selectedPresent
          ? "tested"
          : input.camera.passed && input.camera.selectedPresent
            ? "tested"
            : input.camera.permission === "granted" && input.camera.selectedPresent
              ? "configured"
              : "not-tested";
  const screenStatus: FirstLaunchReadyStatus = input.screen.skipped
    ? "skipped"
    : input.screen.blocked
      ? "blocked"
      : input.screen.unavailable
        ? "unavailable"
        : input.screen.passed
          ? "tested"
          : "not-tested";

  return {
    id: "audio-video",
    labelKey: "steps.audioVideo",
    participation: "included",
    rows: [
      row({ id: "microphone", sectionId: "audio-video", labelKey: "ready.microphone", valueKey: `ready.status.${micStatus}`, status: micStatus, reviewStepId: "audio-video", reviewLabelKey: "ready.reviewMicrophone" }),
      row({ id: "speaker", sectionId: "audio-video", labelKey: "ready.speaker", valueKey: `ready.status.${speakerStatus}`, status: speakerStatus, reviewStepId: "audio-video", reviewLabelKey: "ready.reviewAudio" }),
      row({ id: "camera", sectionId: "audio-video", labelKey: "ready.camera", valueKey: `ready.status.${cameraStatus}`, status: cameraStatus, reviewStepId: "audio-video", reviewLabelKey: "ready.reviewCamera" }),
      row({ id: "screen", sectionId: "audio-video", labelKey: "ready.screenSharing", valueKey: `ready.status.${screenStatus}`, status: screenStatus, reviewStepId: "audio-video", reviewLabelKey: "ready.reviewScreen" }),
    ],
  };
}

function desktopSection(
  input: FirstLaunchReadyInput,
  plan: FirstLaunchPlan,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
): FirstLaunchReadySection {
  const state = participation("desktop", plan, skippedStepIds);
  if (state === "omitted") {
    return { id: "desktop", labelKey: "steps.desktop", participation: "omitted", rows: [row({ id: "desktop-omitted", sectionId: "desktop", labelKey: "steps.desktop", valueKey: "ready.notIncluded", status: "not-in-plan", reviewStepId: "desktop", reviewLabelKey: "ready.configureDesktop" })] };
  }
  if (state === "skipped") {
    return { id: "desktop", labelKey: "steps.desktop", participation: "skipped", rows: [row({ id: "desktop-skipped", sectionId: "desktop", labelKey: "steps.desktop", valueKey: "ready.status.skipped", status: "skipped", reviewStepId: "desktop", reviewLabelKey: "ready.reviewDesktop" })] };
  }
  const startupStatus: FirstLaunchReadyStatus = input.desktop.startupCapability === "unavailable"
    ? "unavailable"
    : "configured";
  return {
    id: "desktop",
    labelKey: "steps.desktop",
    participation: "included",
    rows: [
      row({
        id: "launchAtStartup",
        sectionId: "desktop",
        labelKey: "ready.desktop",
        valueKey: input.desktop.launchAtStartup ? "desktop.summaryOn" : "desktop.summaryOff",
        status: startupStatus,
        reviewStepId: "desktop",
        reviewLabelKey: "ready.reviewDesktop",
      }),
      row({
        id: "startupVisibility",
        sectionId: "desktop",
        labelKey: "ready.desktopStartup",
        valueKey: input.desktop.startupVisibility === "tray" ? "desktop.startupTray" : "desktop.startupNormal",
        status: "configured",
        reviewStepId: "desktop",
        reviewLabelKey: "ready.reviewDesktop",
      }),
      row({
        id: "closeBehavior",
        sectionId: "desktop",
        labelKey: "ready.desktopClose",
        valueKey: input.desktop.closeBehavior === "tray" ? "desktop.closeTray" : "desktop.closeQuit",
        status: "configured",
        reviewStepId: "desktop",
        reviewLabelKey: "ready.reviewDesktop",
      }),
      row({
        id: "startupDestination",
        sectionId: "desktop",
        labelKey: "ready.desktopDestination",
        valueKey: `desktop.destination${input.desktop.startupDestination === "last" ? "Last" : input.desktop.startupDestination === "feed" ? "Feed" : input.desktop.startupDestination === "messages" ? "Messages" : "Communities"}`,
        status: "configured",
        reviewStepId: "desktop",
        reviewLabelKey: "ready.reviewDesktop",
      }),
    ],
  };
}

function notificationSection(
  input: FirstLaunchReadyInput,
  plan: FirstLaunchPlan,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
): FirstLaunchReadySection {
  const state = participation("notifications", plan, skippedStepIds);
  if (state === "omitted") {
    return { id: "notifications", labelKey: "steps.notifications", participation: "omitted", rows: [row({ id: "notifications-omitted", sectionId: "notifications", labelKey: "steps.notifications", valueKey: "ready.notIncluded", status: "not-in-plan", reviewStepId: "notifications", reviewLabelKey: "ready.configureNotifications" })] };
  }
  if (state === "skipped") {
    return { id: "notifications", labelKey: "steps.notifications", participation: "skipped", rows: [row({ id: "notifications-skipped", sectionId: "notifications", labelKey: "steps.notifications", valueKey: "ready.status.skipped", status: "skipped", reviewStepId: "notifications", reviewLabelKey: "ready.reviewNotifications" })] };
  }
  const delivery = notificationStatus(input.notifications.capability);
  const rows: FirstLaunchReadyRow[] = [
    row({ id: "delivery", sectionId: "notifications", labelKey: "ready.notifications", valueKey: delivery.valueKey, status: delivery.status, reviewStepId: "notifications", reviewLabelKey: "ready.reviewNotifications" }),
  ];
  if (input.notifications.quietHoursEnabled) {
    rows.push(row({ id: "quietHours", sectionId: "notifications", labelKey: "ready.quietHours", valueText: input.notifications.quietHoursRange, status: "configured", reviewStepId: "notifications", reviewLabelKey: "ready.reviewNotifications" }));
  }
  if (input.notifications.doNotDisturb) {
    rows.push(row({ id: "dnd", sectionId: "notifications", labelKey: "ready.doNotDisturb", valueKey: "notifications.dnd", status: "configured", reviewStepId: "notifications", reviewLabelKey: "ready.reviewNotifications" }));
  }
  return { id: "notifications", labelKey: "steps.notifications", participation: "included", rows };
}

function privacySection(
  input: FirstLaunchReadyInput,
  plan: FirstLaunchPlan,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
): FirstLaunchReadySection {
  const state = participation("privacy", plan, skippedStepIds);
  if (state === "omitted") {
    return { id: "privacy", labelKey: "steps.privacy", participation: "omitted", rows: [row({ id: "privacy-omitted", sectionId: "privacy", labelKey: "ready.privacy", valueKey: "ready.notIncluded", status: "not-in-plan", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" })] };
  }
  if (state === "skipped" || input.privacy.status === "skipped") {
    return { id: "privacy", labelKey: "steps.privacy", participation: "skipped", rows: [row({ id: "privacy-skipped", sectionId: "privacy", labelKey: "ready.privacy", valueKey: "ready.privacySkipped", status: "skipped", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" })] };
  }
  if (!input.privacy.status || input.privacy.status === "anonymous" || input.privacy.status === "loading") {
    return { id: "privacy", labelKey: "steps.privacy", participation: "included", rows: [row({ id: "privacy-deferred", sectionId: "privacy", labelKey: "ready.privacy", valueKey: "privacy.reviewAfterSignIn", status: "deferred", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" })] };
  }
  if (input.privacy.status === "unavailable") {
    return { id: "privacy", labelKey: "steps.privacy", participation: "included", rows: [row({ id: "privacy-unavailable", sectionId: "privacy", labelKey: "ready.privacy", valueKey: "privacy.loadFailed", status: "unavailable", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" })] };
  }
  return {
    id: "privacy",
    labelKey: "steps.privacy",
    participation: "included",
    rows: [
      row({ id: "friendRequests", sectionId: "privacy", labelKey: "ready.privacyFriendRequests", valueKey: input.privacy.friendRequestKey, status: "configured", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" }),
      row({ id: "directMessages", sectionId: "privacy", labelKey: "ready.privacyDirectMessages", valueKey: input.privacy.directMessageKey, status: "configured", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" }),
      row({ id: "profile", sectionId: "privacy", labelKey: "ready.privacyProfile", valueKey: input.privacy.profileKey, status: "configured", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" }),
      row({ id: "presence", sectionId: "privacy", labelKey: "ready.privacyPresence", valueKey: input.privacy.presenceKey, status: "configured", reviewStepId: "privacy", reviewLabelKey: "ready.reviewPrivacy" }),
    ],
  };
}

export function resolveFirstLaunchReadyState(input: FirstLaunchReadyInput): FirstLaunchReadyState {
  const plan = resolveFirstLaunchPlan({
    selectedPurposeIds: input.purposeIds,
    reviewAllSetup: input.reviewAllSetup,
  });
  const skippedStepIds = input.skippedStepIds ?? [];
  const appearance = appearanceSection(input);
  const audio = audioSection(input, plan, skippedStepIds);
  const desktop = desktopSection(input, plan, skippedStepIds);
  const notifications = notificationSection(input, plan, skippedStepIds);
  const privacy = privacySection(input, plan, skippedStepIds);
  const sections = [appearance, audio, desktop, notifications, privacy];
  const blockers = resolveFirstLaunchCompletionBlockers(input);
  const nextGate = resolveFirstLaunchNextGate(input.session);
  const showProductActions = nextGate === "enter-picom";
  const productActions = showProductActions
    ? resolveFirstProductActions({
      purposeIds: input.purposeIds,
      capabilities: defaultFirstProductActionCapabilities({
        authenticated: true,
        legalAccepted: true,
        onboardingComplete: true,
        ...input.capabilities,
      }),
    })
    : [];

  return {
    plan,
    sections,
    omittedSectionIds: sections.filter((section) => section.participation === "omitted").map((section) => section.id),
    canComplete: blockers.length === 0,
    blockers,
    nextGate,
    primaryCtaKey: nextGate === "sign-in" ? "ready.continueSignIn" : nextGate === "enter-picom" ? "ready.enterPicom" : "ready.continueSetup",
    showProductActions,
    productActions,
    actionMode: FIRST_PRODUCT_ACTION_MODE,
  };
}
