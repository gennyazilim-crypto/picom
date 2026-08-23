export type PicomVerifiedPlanKey = "picom_verified_monthly" | "picom_verified_yearly";

export type PicomVerifiedSubscriptionStatus =
  | "none"
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "grace_period"
  | "paused"
  | "cancelled"
  | "expired"
  | "unpaid";

export type PicomVerifiedPublicSummary = Readonly<{
  subscriptionStatus: PicomVerifiedSubscriptionStatus;
  planKey: PicomVerifiedPlanKey | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: Readonly<{
    adFree: boolean;
    verifiedBadgeEligible: boolean;
    prioritySupport: boolean;
  }>;
  verificationDisplayState: string;
  badgeDisplayState: string;
  customerPortalAvailable: boolean;
}>;

export type PicomVerifiedPaymentStatus = "created" | "awaiting_payment" | "verification_pending" | "paid" | "failed" | "expired" | "cancelled";

export type PicomVerifiedPaymentSummary = Readonly<{
  intentId: string;
  planKey: PicomVerifiedPlanKey;
  billingInterval: "month" | "year";
  status: PicomVerifiedPaymentStatus;
  expiresAt: string;
  verifiedAt: string | null;
  failureCode: string | null;
  activated: boolean;
}>;

export type BillingCatalogPlan = Readonly<{
  planKey: PicomVerifiedPlanKey;
  billingInterval: "month" | "year";
  currency: string;
  amountMinor: number;
  status: "active";
}>;

export type CreateCheckoutInput = Readonly<{
  planKey: PicomVerifiedPlanKey;
  successReturnPath: string;
  cancelReturnPath: string;
  idempotencyKey: string;
}>;

export type CreateCheckoutResult = Readonly<{
  intentId: string;
  paymentUrl: string;
  status: "awaiting_payment";
}>;

export type ReconcileVerifiedPaymentResult = Readonly<{
  outcome: "activated" | "already_activated" | "pending" | "failed" | "expired";
  intentId: string;
  failureCode?: string;
}>;

export type CreatePortalResult = Readonly<{
  portalUrl: string;
  provider: "stripe";
}>;
