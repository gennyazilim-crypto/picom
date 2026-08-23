import {
  FIRST_LAUNCH_STEP_IDS,
  getFirstLaunchStep,
  isFirstLaunchStepId,
  type FirstLaunchStepDefinition,
  type FirstLaunchStepId,
} from "./firstLaunchSetupSteps.ts";

/**
 * PERSONALIZATION RETENTION AFTER COMPLETION:
 * CLEARED
 *
 * Purpose selections are unfinished-device-first-run routing only.
 * They are not account profile data, recommendation input, or analytics.
 */
export const PERSONALIZATION_RETENTION_AFTER_COMPLETION = "CLEARED" as const;

/**
 * Empty purpose selection does not guess intent and does not enable permissions.
 * Guided plan is welcome → personalize → appearance → ready.
 * Review all setup options remains available before Ready.
 */
export const FIRST_LAUNCH_NO_SELECTION_BEHAVIOR = "MINIMAL_GUIDED_PLAN" as const;

export const FIRST_LAUNCH_PURPOSE_IDS = [
  "friends",
  "communities",
  "gaming",
  "work",
  "creator",
] as const;

export type FirstLaunchPurposeId = (typeof FIRST_LAUNCH_PURPOSE_IDS)[number];

export const FIRST_LAUNCH_REQUIRED_PLAN_STEP_IDS = [
  "welcome",
  "personalize",
  "appearance",
  "ready",
] as const satisfies readonly FirstLaunchStepId[];

export const FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS = [
  "audio-video",
  "desktop",
  "notifications",
  "privacy",
] as const satisfies readonly FirstLaunchStepId[];

export type FirstLaunchAdaptiveOptionalStepId = (typeof FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS)[number];

/** Data-driven purpose → optional step mapping. Registry IDs only. */
export const FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS = {
  friends: ["audio-video", "notifications", "privacy"],
  communities: ["notifications", "privacy"],
  gaming: ["audio-video", "desktop", "notifications"],
  work: ["audio-video", "desktop", "notifications", "privacy"],
  creator: ["audio-video", "notifications", "privacy"],
} as const satisfies Readonly<Record<FirstLaunchPurposeId, readonly FirstLaunchAdaptiveOptionalStepId[]>>;

const LEGACY_PURPOSE_MAP: Readonly<Record<string, FirstLaunchPurposeId>> = {
  friends: "friends",
  communities: "communities",
  gaming: "gaming",
  work: "work",
  creator: "creator",
  "friends-communication": "friends",
  "work-team": "work",
  "creator-streaming": "creator",
};

export type FirstLaunchPlan = Readonly<{
  selectedPurposeIds: readonly FirstLaunchPurposeId[];
  reviewAllSetup: boolean;
  noSelection: boolean;
  includedStepIds: readonly FirstLaunchStepId[];
  recommendedStepIds: readonly FirstLaunchStepId[];
  omittedOptionalStepIds: readonly FirstLaunchAdaptiveOptionalStepId[];
}>;

export type FirstLaunchPlanInput = Readonly<{
  selectedPurposeIds?: unknown;
  purposeIds?: unknown;
  reviewAllSetup?: unknown;
}>;

export function isFirstLaunchPurposeId(value: unknown): value is FirstLaunchPurposeId {
  return typeof value === "string" && (FIRST_LAUNCH_PURPOSE_IDS as readonly string[]).includes(value);
}

export function isFirstLaunchAdaptiveOptionalStepId(value: unknown): value is FirstLaunchAdaptiveOptionalStepId {
  return typeof value === "string" && (FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS as readonly string[]).includes(value);
}

function mapLegacyPurposeId(value: unknown): FirstLaunchPurposeId | null {
  if (typeof value !== "string") return null;
  return LEGACY_PURPOSE_MAP[value] ?? null;
}

/** Strict allowlist. Unknown, blank, and duplicate values are dropped. */
export function sanitizeFirstLaunchPurposeIds(value: unknown): readonly FirstLaunchPurposeId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<FirstLaunchPurposeId>();
  const sanitized: FirstLaunchPurposeId[] = [];
  for (const item of value) {
    const mapped = mapLegacyPurposeId(item);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    sanitized.push(mapped);
  }
  return sanitized;
}

export function sanitizeReviewAllSetup(value: unknown): boolean {
  return value === true;
}

function unionOptionalSteps(purposeIds: readonly FirstLaunchPurposeId[]): readonly FirstLaunchAdaptiveOptionalStepId[] {
  const selected = new Set<FirstLaunchAdaptiveOptionalStepId>();
  for (const purposeId of purposeIds) {
    for (const stepId of FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS[purposeId]) {
      selected.add(stepId);
    }
  }
  return FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS.filter((stepId) => selected.has(stepId));
}

function inCanonicalOrder(stepIds: readonly FirstLaunchStepId[]): readonly FirstLaunchStepId[] {
  return FIRST_LAUNCH_STEP_IDS.filter((stepId) => stepIds.includes(stepId));
}

export function assertFirstLaunchPurposeMapping(): void {
  for (const purposeId of FIRST_LAUNCH_PURPOSE_IDS) {
    for (const stepId of FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS[purposeId]) {
      if (!isFirstLaunchStepId(stepId) || !isFirstLaunchAdaptiveOptionalStepId(stepId)) {
        throw new Error(`Purpose ${purposeId} references unknown step ${stepId}`);
      }
    }
  }
  for (const stepId of FIRST_LAUNCH_REQUIRED_PLAN_STEP_IDS) {
    if (!isFirstLaunchStepId(stepId)) {
      throw new Error(`Required plan step ${stepId} is missing from the canonical registry`);
    }
  }
}

/**
 * Pure adaptive planner. Does not mutate the canonical eight-step registry
 * and does not change product settings or request permissions.
 */
export function resolveFirstLaunchPlan(input: FirstLaunchPlanInput = {}): FirstLaunchPlan {
  const selectedPurposeIds = sanitizeFirstLaunchPurposeIds(input.selectedPurposeIds ?? input.purposeIds);
  const reviewAllSetup = sanitizeReviewAllSetup(input.reviewAllSetup);
  const purposeOptionalStepIds = unionOptionalSteps(selectedPurposeIds);
  const includedOptionalStepIds = reviewAllSetup
    ? FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS
    : purposeOptionalStepIds;
  const includedStepIds = inCanonicalOrder([
    ...FIRST_LAUNCH_REQUIRED_PLAN_STEP_IDS,
    ...includedOptionalStepIds,
  ]);
  const recommendedStepIds = inCanonicalOrder([
    ...FIRST_LAUNCH_REQUIRED_PLAN_STEP_IDS,
    ...purposeOptionalStepIds,
  ]);
  const omittedOptionalStepIds = FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS.filter(
    (stepId) => !includedStepIds.includes(stepId),
  );

  return {
    selectedPurposeIds,
    reviewAllSetup,
    noSelection: selectedPurposeIds.length === 0,
    includedStepIds,
    recommendedStepIds,
    omittedOptionalStepIds,
  };
}

export function getNextIncludedStep(
  currentId: FirstLaunchStepId,
  includedStepIds: readonly FirstLaunchStepId[],
): FirstLaunchStepDefinition | undefined {
  const included = inCanonicalOrder(includedStepIds.filter(isFirstLaunchStepId));
  const index = included.indexOf(currentId);
  if (index >= 0) {
    const nextId = included[index + 1];
    return nextId ? getFirstLaunchStep(nextId) : undefined;
  }
  const currentOrder = getFirstLaunchStep(currentId)?.order ?? 0;
  const nextId = included.find((stepId) => (getFirstLaunchStep(stepId)?.order ?? 0) > currentOrder);
  return nextId ? getFirstLaunchStep(nextId) : undefined;
}

export function getPreviousIncludedStep(
  currentId: FirstLaunchStepId,
  includedStepIds: readonly FirstLaunchStepId[],
): FirstLaunchStepDefinition | undefined {
  const included = inCanonicalOrder(includedStepIds.filter(isFirstLaunchStepId));
  const index = included.indexOf(currentId);
  if (index > 0) return getFirstLaunchStep(included[index - 1]);
  if (index === 0) return undefined;
  const currentOrder = getFirstLaunchStep(currentId)?.order ?? 0;
  const previousId = [...included].reverse().find((stepId) => (getFirstLaunchStep(stepId)?.order ?? 0) < currentOrder);
  return previousId ? getFirstLaunchStep(previousId) : undefined;
}

/** Deterministic resume rule: previous included step, else next included, else welcome. */
export function nearestIncludedStep(
  currentId: FirstLaunchStepId,
  includedStepIds: readonly FirstLaunchStepId[],
): FirstLaunchStepId {
  const included = inCanonicalOrder(includedStepIds.filter(isFirstLaunchStepId));
  if (included.includes(currentId)) return currentId;
  const previous = getPreviousIncludedStep(currentId, included);
  if (previous) return previous.id;
  const next = getNextIncludedStep(currentId, included);
  return next?.id ?? included[0] ?? "welcome";
}

export function getGuidedPlanProgress(
  currentId: FirstLaunchStepId,
  includedStepIds: readonly FirstLaunchStepId[],
): Readonly<{ current: number; total: number }> {
  const included = inCanonicalOrder(includedStepIds.filter(isFirstLaunchStepId));
  const total = Math.max(included.length, 1);
  const index = included.indexOf(currentId);
  return { current: index >= 0 ? index + 1 : 1, total };
}

export function isStepOmittedByPlan(stepId: FirstLaunchStepId, plan: FirstLaunchPlan): boolean {
  return !plan.includedStepIds.includes(stepId);
}

export function withCurrentStepInPlan(plan: FirstLaunchPlan, currentStep: FirstLaunchStepId): FirstLaunchPlan {
  if (plan.includedStepIds.includes(currentStep) || !isFirstLaunchStepId(currentStep)) return plan;
  const includedStepIds = inCanonicalOrder([...plan.includedStepIds, currentStep]);
  return {
    ...plan,
    includedStepIds,
    omittedOptionalStepIds: FIRST_LAUNCH_ADAPTIVE_OPTIONAL_STEP_IDS.filter((stepId) => !includedStepIds.includes(stepId)),
  };
}
