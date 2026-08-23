import { resolveFirstLaunchPlan } from "./firstLaunchPersonalization.ts";
import type { FirstLaunchSetupState, FirstLaunchSetupStatePatch } from "./firstLaunchSetupState.ts";
import { isFirstLaunchStepId, type FirstLaunchStepId } from "./firstLaunchSetupSteps.ts";

/** Opens a canonical step. Omitted steps become reachable via Review All without marking skipped. */
export function reviewFirstLaunchStep(
  state: FirstLaunchSetupState,
  stepId: FirstLaunchStepId,
): FirstLaunchSetupStatePatch {
  const plan = resolveFirstLaunchPlan({
    selectedPurposeIds: state.purposeIds,
    reviewAllSetup: state.reviewAllSetup,
  });
  if (!plan.includedStepIds.includes(stepId)) {
    return { reviewAllSetup: true, currentStep: stepId };
  }
  return { currentStep: stepId };
}

export function isReviewableFirstLaunchStep(value: unknown): value is FirstLaunchStepId {
  return isFirstLaunchStepId(value) && value !== "ready";
}
