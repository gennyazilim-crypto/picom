import { sanitizeFirstProductActionId, type FirstProductActionId } from "./firstLaunchProductActions.ts";

/**
 * Session-local, one-shot, high-level post-auth handoff.
 * Never stores URLs, user IDs, conversation IDs, channel IDs, or invite tokens.
 */
let pendingAction: FirstProductActionId | null = null;
let ownerUserId: string | null = null;

export function setFirstLaunchHandoffIntent(value: unknown, userId?: string | null): FirstProductActionId | null {
  const action = sanitizeFirstProductActionId(value);
  pendingAction = action;
  ownerUserId = action ? userId ?? null : null;
  return action;
}

export function peekFirstLaunchHandoffIntent(): FirstProductActionId | null {
  return pendingAction;
}

export function consumeFirstLaunchHandoffIntent(userId?: string | null): FirstProductActionId | null {
  if (ownerUserId && userId && ownerUserId !== userId) {
    clearFirstLaunchHandoffIntent();
    return null;
  }
  const action = pendingAction;
  clearFirstLaunchHandoffIntent();
  return action;
}

export function clearFirstLaunchHandoffIntent(): void {
  pendingAction = null;
  ownerUserId = null;
}

export type FirstLaunchRouteDecision =
  | "gate"
  | "explicit-external"
  | "handoff-intent"
  | "startup-destination";

/** Documented Ready/handoff precedence. Never overrides auth, legal, or notification intents. */
export function resolveFirstLaunchRouteDecision(input: Readonly<{
  firstLaunchRequired: boolean;
  authenticationRequired: boolean;
  legalRequired: boolean;
  accountOnboardingRequired: boolean;
  hasExplicitExternalIntent: boolean;
  hasHandoffIntent: boolean;
}>): FirstLaunchRouteDecision {
  if (input.firstLaunchRequired || input.authenticationRequired || input.legalRequired || input.accountOnboardingRequired) {
    return "gate";
  }
  if (input.hasExplicitExternalIntent) return "explicit-external";
  if (input.hasHandoffIntent) return "handoff-intent";
  return "startup-destination";
}
