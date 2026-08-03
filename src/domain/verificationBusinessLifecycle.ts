import type { EntitlementStatus } from "../types/verificationBusiness/entitlements";
import type { ComplianceStatus, MonetizationStatus, PayoutOnboardingStatus } from "../types/verificationBusiness/monetization";

export type EntitlementLifecycleInput = Readonly<{
  status: EntitlementStatus;
  startsAt: string | null;
  endsAt: string | null;
  graceUntil: string | null;
  now?: string;
}>;

export type MonetizationStateCombination = Readonly<{
  badgeStatus: "none" | "pending" | "active" | "suspended" | "revoked" | "expired";
  monetizationStatus: MonetizationStatus;
  payoutOnboardingStatus: PayoutOnboardingStatus;
  complianceStatus: ComplianceStatus;
}>;

export function isEntitlementCurrentlyUsable(input: EntitlementLifecycleInput): boolean {
  const now = Date.parse(input.now ?? new Date().toISOString());
  if (Number.isNaN(now)) return false;
  if (input.status === "revoked" || input.status === "expired" || input.status === "suspended" || input.status === "pending") {
    return false;
  }
  if (input.startsAt && Date.parse(input.startsAt) > now) return false;
  if (input.status === "active") {
    if (input.endsAt && Date.parse(input.endsAt) <= now) return false;
    return true;
  }
  if (input.status === "grace_period") {
    if (!input.graceUntil || Date.parse(input.graceUntil) <= now) return false;
    return true;
  }
  return false;
}

export function canReceivePayout(state: MonetizationStateCombination): boolean {
  return (
    state.badgeStatus === "active" &&
    state.monetizationStatus === "active" &&
    state.payoutOnboardingStatus === "complete" &&
    state.complianceStatus === "clear"
  );
}

export function canDisplayBadgeWithoutPayout(state: MonetizationStateCombination): boolean {
  return state.badgeStatus === "active" && state.monetizationStatus !== "active";
}
