import type { FirstLaunchSetupState } from "./firstLaunchSetupState.ts";

/**
 * Fail-closed completion helper. Persistence must succeed before the completed
 * flag, adaptive purge, or UI exit is treated as committed.
 */
export function commitFirstLaunchCompletion<T>(input: Readonly<{
  current: T;
  next: T;
  alreadyComplete: boolean;
  persist: (next: T) => boolean;
}>): Readonly<{ ok: boolean; value: T }> {
  if (input.alreadyComplete) return { ok: true, value: input.current };
  if (!input.persist(input.next)) return { ok: false, value: input.current };
  return { ok: true, value: input.next };
}

export function firstLaunchCompletionPreservesProductSettings(
  before: FirstLaunchSetupState,
  after: FirstLaunchSetupState,
): boolean {
  return after.completed
    && after.locale === before.locale
    && after.theme === before.theme
    && after.skippedStepIds.length === before.skippedStepIds.length
    && after.skippedStepIds.every((stepId, index) => stepId === before.skippedStepIds[index]);
}
