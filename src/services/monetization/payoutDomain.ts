/** Server-aligned payout/monetization domain helpers for regressions and UI guards. */

export const MONETIZATION_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "requires_information",
  "approved",
  "rejected",
  "suspended",
  "revoked",
  "expired",
] as const;

export const MONETIZATION_STATUSES = [
  "not_applied",
  "pending",
  "eligible",
  "approved",
  "active",
  "limited",
  "suspended",
  "revoked",
  "not_eligible",
] as const;

export const ACCRUAL_STATUSES = [
  "pending",
  "held",
  "available",
  "reserved_for_payout",
  "processing",
  "paid",
  "reversed",
  "disputed",
  "expired",
] as const;

export const HOLD_REASONS = [
  "standard_settlement",
  "invalid_traffic_review",
  "tax_information_required",
  "payout_onboarding_incomplete",
  "compliance_review",
  "account_suspension",
  "dispute",
  "chargeback_exposure",
  "minimum_payout_not_reached",
  "manual_risk_hold",
  "legal_hold",
] as const;

export const RESERVE_REASONS = [
  "invalid_traffic_reserve",
  "refund_reserve",
  "dispute_reserve",
  "provider_reserve",
  "manual_financial_reserve",
] as const;

export const RETRYABLE_FAILURE_CODES = [
  "provider_timeout",
  "temporary_provider_error",
  "rate_limit",
  "transient_bank_unavailable",
] as const;

export const TERMINAL_FAILURE_CODES = [
  "invalid_account",
  "account_closed",
  "beneficiary_mismatch",
  "compliance_block",
  "tax_block",
  "unsupported_currency",
  "provider_account_disabled",
  "suspected_fraud",
] as const;

export const PUBLIC_TRANSPARENCY_FORBIDDEN_KEYS = [
  "bid",
  "pricing",
  "billable_rate",
  "targeting_spec",
  "exact_audience",
  "fraud_model",
  "internal_review",
  "iban",
  "tax_id",
  "bank_account",
  "service_role",
] as const;

export type PartnerBalance = Readonly<{
  pending_minor: number;
  held_minor: number;
  available_minor: number;
  reserved_for_payout_minor: number;
  processing_minor: number;
  paid_lifetime_minor: number;
  reversed_lifetime_minor: number;
  currency: string;
}>;

export function assertIntegerMinor(amount: number, label = "amount"): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${label.toUpperCase()}_INVALID`);
  }
}

export function computeSharesFromBasisPoints(
  eligibleMinor: number,
  platformBps: number,
  partnerBps: number,
): { platformShareMinor: number; partnerShareMinor: number } {
  assertIntegerMinor(eligibleMinor, "eligible");
  if (!Number.isInteger(platformBps) || !Number.isInteger(partnerBps)) {
    throw new Error("BPS_INVALID");
  }
  if (platformBps + partnerBps !== 10000) {
    throw new Error("CONTRACT_SHARE_BPS_INVALID");
  }
  const platformShareMinor = Math.floor((eligibleMinor * platformBps) / 10000);
  const partnerShareMinor = eligibleMinor - platformShareMinor;
  return { platformShareMinor, partnerShareMinor };
}

export function assertPayoutNetInvariant(input: Readonly<{
  gross: number;
  reserve: number;
  withholding: number;
  fees: number;
  net: number;
}>): void {
  const { gross, reserve, withholding, fees, net } = input;
  for (const [label, value] of Object.entries(input)) {
    assertIntegerMinor(value, label);
  }
  if (gross - reserve - withholding - fees !== net) {
    throw new Error("PAYOUT_NET_INVARIANT");
  }
  if (net < 0) throw new Error("NEGATIVE_NET_PAYOUT");
}

export function deriveAvailableBalance(input: Readonly<{
  availableAccrualsMinor: number;
  activeReservesMinor: number;
  withholdingMinor: number;
  reservedForPayoutMinor: number;
  reversalsMinor: number;
  pendingReturnsMinor: number;
}>): number {
  for (const [label, value] of Object.entries(input)) {
    assertIntegerMinor(value, label);
  }
  const available =
    input.availableAccrualsMinor
    - input.activeReservesMinor
    - input.withholdingMinor
    - input.reservedForPayoutMinor
    - input.reversalsMinor
    - input.pendingReturnsMinor;
  if (available < 0) throw new Error("NEGATIVE_AVAILABLE_BALANCE");
  return available;
}

export function badgeDoesNotGrantPayout(badgeStatus: string, monetizationStatus: string, payoutEligible: boolean): boolean {
  return badgeStatus === "active" && monetizationStatus !== "active" && !payoutEligible;
}

export function monetizationDoesNotGrantPayout(monetizationStatus: string, payoutOnboardingStatus: string): boolean {
  return (monetizationStatus === "approved" || monetizationStatus === "active")
    && payoutOnboardingStatus !== "complete";
}

export function isAccrualBatchEligible(status: string, trafficStatus?: string): boolean {
  if (trafficStatus === "invalid" || trafficStatus === "under_review") return false;
  return status === "available";
}

export function canMapAccrualToPayoutItem(status: string): boolean {
  return status === "available";
}

export function isFailureRetryable(code: string): boolean {
  return (RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export function isFailureTerminal(code: string): boolean {
  return (TERMINAL_FAILURE_CODES as readonly string[]).includes(code);
}

export function canProcessBatch(input: Readonly<{
  batchStatus: string;
  globalPayoutsEnabled: boolean;
  providerPayoutsEnabled: boolean;
  batchProcessingEnabled: boolean;
  programEnabled: boolean;
}>): { ok: true } | { ok: false; code: string } {
  if (!input.globalPayoutsEnabled) return { ok: false, code: "GLOBAL_PAYOUTS_DISABLED" };
  if (!input.providerPayoutsEnabled) return { ok: false, code: "PROVIDER_PAYOUTS_DISABLED" };
  if (!input.batchProcessingEnabled) return { ok: false, code: "BATCH_PROCESSING_DISABLED" };
  if (!input.programEnabled) return { ok: false, code: "PROGRAM_PAYOUTS_DISABLED" };
  if (input.batchStatus !== "approved") return { ok: false, code: "BATCH_NOT_APPROVED" };
  return { ok: true };
}

export function canReplayPaidItem(status: string): boolean {
  return status !== "paid" && status !== "returned" && status !== "reversed";
}

export function assertPublicTransparencySafe(payload: Record<string, unknown>): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const key of PUBLIC_TRANSPARENCY_FORBIDDEN_KEYS) {
    if (serialized.includes(key)) throw new Error(`TRANSPARENCY_LEAK:${key}`);
  }
}

export function isOrganicBusinessExcludedFromArchive(contentKind: string, isSponsoredDelivery: boolean): boolean {
  return contentKind === "organic_business_post" || !isSponsoredDelivery;
}

export function formatMinorAsAccessible(amountMinor: number, currency: string): string {
  assertIntegerMinor(amountMinor);
  const major = (amountMinor / 100).toFixed(2);
  return `${major} ${currency}`;
}

export function dualApprovalBlocked(createdBy: string | null, approverId: string | null, dualRequired: boolean): boolean {
  if (!dualRequired) return false;
  if (!createdBy || !approverId) return true;
  return createdBy === approverId;
}

export function resolvePublicEligibilityDto(internal: Readonly<{
  eligible: boolean;
  reason_code: string;
  next_required_action?: string | null;
  available_amount_minor?: number;
  minimum_payout_minor?: number;
  currency?: string;
  risk_hold?: string;
  tax_detail?: string;
  provider_detail?: string;
}>): Record<string, unknown> {
  return {
    eligible: internal.eligible,
    reason_code: internal.reason_code,
    next_required_action: internal.next_required_action ?? null,
    available_amount_minor: internal.available_amount_minor ?? 0,
    minimum_payout_minor: internal.minimum_payout_minor ?? 0,
    currency: internal.currency ?? null,
  };
}
