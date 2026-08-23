import {
  getFirstLaunchStep,
  isFirstLaunchOptionalStepId,
  migrateFirstLaunchStepId,
  type FirstLaunchOptionalStepId,
  type FirstLaunchStepId,
} from "./firstLaunchSetupSteps.ts";
import {
  getNextIncludedStep,
  nearestIncludedStep,
  resolveFirstLaunchPlan,
  sanitizeFirstLaunchPurposeIds,
  sanitizeReviewAllSetup,
  type FirstLaunchPurposeId,
} from "./firstLaunchPersonalization.ts";
import {
  isUiLanguage,
  normalizeUiLanguage,
  type UiLanguage,
} from "./localization/uiLanguages.ts";
import type { ThemePreference } from "./settingsService.ts";

export type { FirstLaunchOptionalStepId, FirstLaunchStepId } from "./firstLaunchSetupSteps.ts";
export type { FirstLaunchPurposeId } from "./firstLaunchPersonalization.ts";

/**
 * Version 3 adds device-local purposeIds and reviewAllSetup for adaptive
 * first-run planning. Completed v1/v2 users remain completed.
 */
export const FIRST_LAUNCH_SETUP_VERSION = 3;

const KNOWN_FIRST_LAUNCH_VERSIONS = new Set([1, 2, 3, undefined]);

export type FirstLaunchSetupState = Readonly<{
  version: typeof FIRST_LAUNCH_SETUP_VERSION;
  completed: boolean;
  currentStep: FirstLaunchStepId;
  locale: UiLanguage;
  theme: ThemePreference;
  purposeIds: readonly FirstLaunchPurposeId[];
  reviewAllSetup: boolean;
  skippedStepIds: readonly FirstLaunchOptionalStepId[];
  updatedAt: string;
}>;

export type FirstLaunchSetupStateSeed = Readonly<{
  completed: boolean;
  locale: UiLanguage;
  theme: ThemePreference;
}>;

export type FirstLaunchSetupStatePatch = Partial<Pick<
  FirstLaunchSetupState,
  "currentStep" | "locale" | "theme" | "purposeIds" | "reviewAllSetup" | "skippedStepIds"
>>;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isSupportedLocaleLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const base = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isUiLanguage(base);
}

function resolveLocale(value: unknown, fallback: UiLanguage): UiLanguage {
  return isSupportedLocaleLike(value) ? normalizeUiLanguage(value) : fallback;
}

function resolveTheme(value: unknown, fallback: ThemePreference): ThemePreference {
  return isThemePreference(value) ? value : fallback;
}

function safeSeed(seed: FirstLaunchSetupStateSeed): FirstLaunchSetupStateSeed {
  return {
    completed: seed.completed === true,
    locale: resolveLocale(seed.locale, "en"),
    theme: resolveTheme(seed.theme, "system"),
  };
}

function readPersistedPurposeIds(input: Record<string, unknown>): unknown {
  if (Object.prototype.hasOwnProperty.call(input, "purposeIds")) return input.purposeIds;
  return input.personalization;
}

/**
 * v1/v2 drafts predate adaptive planning. Missing reviewAllSetup keeps the
 * full eight-step guided flow so migration can preserve currentStep.
 * New v3 drafts persist the field explicitly (default false).
 */
function resolveReviewAllSetup(input: Record<string, unknown>, completed: boolean): boolean {
  if (completed) return false;
  if (Object.prototype.hasOwnProperty.call(input, "reviewAllSetup")) return sanitizeReviewAllSetup(input.reviewAllSetup);
  return input.version === 1 || input.version === 2;
}

function sanitizeSkippedSteps(value: unknown): readonly FirstLaunchOptionalStepId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isFirstLaunchOptionalStepId))];
}

/** Creates a fresh, incomplete, device-only first-run draft. */
export function createFirstLaunchSetupState(
  seed: Omit<FirstLaunchSetupStateSeed, "completed"> & Partial<Pick<FirstLaunchSetupStateSeed, "completed">>,
  now = new Date().toISOString(),
): FirstLaunchSetupState {
  const safe = safeSeed({ completed: seed.completed === true, locale: seed.locale, theme: seed.theme });
  return {
    version: FIRST_LAUNCH_SETUP_VERSION,
    completed: safe.completed,
    currentStep: safe.completed ? "ready" : "welcome",
    locale: safe.locale,
    theme: safe.theme,
    purposeIds: [],
    reviewAllSetup: false,
    skippedStepIds: [],
    updatedAt: now,
  };
}

/**
 * Converts untrusted local storage to the canonical eight-step state. Legacy v1
 * `permissions` safely becomes `notifications`; a newer incomplete draft falls back
 * to Welcome while retaining valid device preferences and completed state.
 *
 * Purpose selections belong to the unfinished device draft only. Completed
 * drafts purge adaptive-only metadata.
 */
export function normalizeFirstLaunchSetupState(
  raw: unknown,
  seed: FirstLaunchSetupStateSeed,
  now = new Date().toISOString(),
  options: Readonly<{ allowExcludedCurrentStep?: boolean }> = {},
): FirstLaunchSetupState {
  const safe = safeSeed(seed);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createFirstLaunchSetupState(safe, now);
  }

  const input = raw as Record<string, unknown>;
  const knownVersion = KNOWN_FIRST_LAUNCH_VERSIONS.has(input.version as number | undefined);
  const completed = input.completed === true || safe.completed;
  const purposeIds = completed ? [] : sanitizeFirstLaunchPurposeIds(readPersistedPurposeIds(input));
  const reviewAllSetup = resolveReviewAllSetup(input, completed);
  const migratedStep = migrateFirstLaunchStepId(input.currentStep);
  const plan = resolveFirstLaunchPlan({ selectedPurposeIds: purposeIds, reviewAllSetup });
  let currentStep: FirstLaunchStepId = "welcome";
  if (completed) {
    currentStep = "ready";
  } else if (knownVersion && migratedStep) {
    currentStep = options.allowExcludedCurrentStep || plan.includedStepIds.includes(migratedStep)
      ? migratedStep
      : nearestIncludedStep(migratedStep, plan.includedStepIds);
  }

  return {
    version: FIRST_LAUNCH_SETUP_VERSION,
    completed,
    currentStep,
    locale: resolveLocale(input.locale, safe.locale),
    theme: resolveTheme(input.theme, safe.theme),
    purposeIds,
    reviewAllSetup,
    skippedStepIds: sanitizeSkippedSteps(input.skippedStepIds),
    updatedAt: isTimestamp(input.updatedAt) ? input.updatedAt : now,
  };
}

/** Applies a persisted UI transition without permitting an accidental completion reset. */
export function updateFirstLaunchSetupState(
  state: FirstLaunchSetupState,
  patch: FirstLaunchSetupStatePatch,
  now = new Date().toISOString(),
): FirstLaunchSetupState {
  const revisitedStep = patch.currentStep;
  const skippedStepIds = revisitedStep
    ? state.skippedStepIds.filter((stepId) => stepId !== revisitedStep)
    : state.skippedStepIds;
  return normalizeFirstLaunchSetupState(
    { ...state, ...patch, skippedStepIds: patch.skippedStepIds ?? skippedStepIds, completed: state.completed },
    state,
    now,
    { allowExcludedCurrentStep: patch.currentStep !== undefined },
  );
}

/** Records an optional-step skip and advances without treating setup as complete. */
export function skipFirstLaunchSetupStep(
  state: FirstLaunchSetupState,
  stepId: FirstLaunchOptionalStepId,
  now = new Date().toISOString(),
): FirstLaunchSetupState {
  const plan = resolveFirstLaunchPlan({
    selectedPurposeIds: state.purposeIds,
    reviewAllSetup: state.reviewAllSetup,
  });
  const visibleToUser = plan.includedStepIds.includes(stepId) || state.currentStep === stepId;
  if (!visibleToUser) return state;
  const next = getNextIncludedStep(stepId, plan.includedStepIds);
  if (!next) return state;
  return updateFirstLaunchSetupState(state, {
    currentStep: next.id,
    skippedStepIds: [...new Set([...state.skippedStepIds, stepId])],
  }, now);
}

/**
 * Marks the completed state only after the final Ready action succeeds.
 * Adaptive-only purpose metadata is cleared; configured product settings are not.
 */
export function completeFirstLaunchSetupState(
  state: FirstLaunchSetupState,
  now = new Date().toISOString(),
): FirstLaunchSetupState {
  return normalizeFirstLaunchSetupState(
    {
      ...state,
      completed: true,
      currentStep: "ready",
      purposeIds: [],
      reviewAllSetup: false,
      updatedAt: now,
    },
    state,
    now,
  );
}

export function getFirstLaunchStepOrder(stepId: FirstLaunchStepId): number {
  return getFirstLaunchStep(stepId)?.order ?? 1;
}
