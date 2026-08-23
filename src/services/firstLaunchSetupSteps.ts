/** Stable device-first-run navigation contract. Persist IDs, never array indexes. */
export const FIRST_LAUNCH_STEP_IDS = [
  "welcome",
  "personalize",
  "appearance",
  "audio-video",
  "desktop",
  "notifications",
  "privacy",
  "ready",
] as const;

export type FirstLaunchStepId = (typeof FIRST_LAUNCH_STEP_IDS)[number];
export type FirstLaunchStepIcon = "home" | "users" | "sun" | "camera" | "settings" | "bell" | "lock" | "send";
export type FirstLaunchProgressBehavior = "included";

export type FirstLaunchStepDefinition = Readonly<{
  id: FirstLaunchStepId;
  order: number;
  labelKey: `steps.${string}`;
  descriptionKey: string;
  icon: FirstLaunchStepIcon;
  optional: boolean;
  canSkip: boolean;
  progress: FirstLaunchProgressBehavior;
  renderKey: FirstLaunchStepId;
}>;

export const FIRST_LAUNCH_STEP_REGISTRY = [
  { id: "welcome", order: 1, labelKey: "steps.welcome", descriptionKey: "welcome.body", icon: "home", optional: false, canSkip: false, progress: "included", renderKey: "welcome" },
  { id: "personalize", order: 2, labelKey: "steps.personalize", descriptionKey: "personalize.body", icon: "users", optional: true, canSkip: true, progress: "included", renderKey: "personalize" },
  { id: "appearance", order: 3, labelKey: "steps.appearance", descriptionKey: "appearance.body", icon: "sun", optional: false, canSkip: false, progress: "included", renderKey: "appearance" },
  { id: "audio-video", order: 4, labelKey: "steps.audioVideo", descriptionKey: "audioVideo.body", icon: "camera", optional: true, canSkip: true, progress: "included", renderKey: "audio-video" },
  { id: "desktop", order: 5, labelKey: "steps.desktop", descriptionKey: "desktop.body", icon: "settings", optional: true, canSkip: true, progress: "included", renderKey: "desktop" },
  { id: "notifications", order: 6, labelKey: "steps.notifications", descriptionKey: "notifications.body", icon: "bell", optional: true, canSkip: true, progress: "included", renderKey: "notifications" },
  { id: "privacy", order: 7, labelKey: "steps.privacy", descriptionKey: "privacy.body", icon: "lock", optional: true, canSkip: true, progress: "included", renderKey: "privacy" },
  { id: "ready", order: 8, labelKey: "steps.ready", descriptionKey: "ready.body", icon: "send", optional: false, canSkip: false, progress: "included", renderKey: "ready" },
] as const satisfies readonly FirstLaunchStepDefinition[];

export type FirstLaunchOptionalStepId = Extract<(typeof FIRST_LAUNCH_STEP_REGISTRY)[number], { optional: true }> ["id"];
export type FirstLaunchStepNavigationStatus = "current" | "completed" | "skipped" | "upcoming" | "omitted";

const legacyStepMap: Readonly<Record<string, FirstLaunchStepId>> = {
  welcome: "welcome",
  appearance: "appearance",
  permissions: "notifications",
  ready: "ready",
};

export function isFirstLaunchStepId(value: unknown): value is FirstLaunchStepId {
  return typeof value === "string" && (FIRST_LAUNCH_STEP_IDS as readonly string[]).includes(value);
}

export function getFirstLaunchStep(id: FirstLaunchStepId): FirstLaunchStepDefinition | undefined {
  return FIRST_LAUNCH_STEP_REGISTRY.find((step) => step.id === id);
}

export function isFirstLaunchOptionalStepId(value: unknown): value is FirstLaunchOptionalStepId {
  return isFirstLaunchStepId(value) && getFirstLaunchStep(value)?.canSkip === true;
}

export function migrateFirstLaunchStepId(value: unknown): FirstLaunchStepId | null {
  if (isFirstLaunchStepId(value)) return value;
  return typeof value === "string" ? legacyStepMap[value] ?? null : null;
}

export function getNextFirstLaunchStep(id: FirstLaunchStepId): FirstLaunchStepDefinition | undefined {
  const index = FIRST_LAUNCH_STEP_REGISTRY.findIndex((step) => step.id === id);
  return index < 0 ? undefined : FIRST_LAUNCH_STEP_REGISTRY[index + 1];
}

export function getPreviousFirstLaunchStep(id: FirstLaunchStepId): FirstLaunchStepDefinition | undefined {
  const index = FIRST_LAUNCH_STEP_REGISTRY.findIndex((step) => step.id === id);
  return index > 0 ? FIRST_LAUNCH_STEP_REGISTRY[index - 1] : undefined;
}

export function getFirstLaunchStepNavigationStatus(
  id: FirstLaunchStepId,
  currentStep: FirstLaunchStepId,
  skippedStepIds: readonly FirstLaunchOptionalStepId[],
  includedStepIds?: readonly FirstLaunchStepId[],
): FirstLaunchStepNavigationStatus {
  if (includedStepIds && !includedStepIds.includes(id)) return "omitted";
  if (id === currentStep) return "current";
  if (skippedStepIds.includes(id as FirstLaunchOptionalStepId)) return "skipped";
  if (includedStepIds) {
    const stepIndex = includedStepIds.indexOf(id);
    const currentIndex = includedStepIds.indexOf(currentStep);
    return stepIndex >= 0 && currentIndex >= 0 && stepIndex < currentIndex ? "completed" : "upcoming";
  }
  const step = getFirstLaunchStep(id);
  const current = getFirstLaunchStep(currentStep);
  return step && current && step.order < current.order ? "completed" : "upcoming";
}
