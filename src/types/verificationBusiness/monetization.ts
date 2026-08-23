import type { IsoTimestamp, Uuid } from "./shared";

export type MonetizationStatus = "pending" | "eligible" | "active" | "suspended" | "revoked" | "not_eligible";
export type PayoutOnboardingStatus = "not_started" | "incomplete" | "pending_review" | "complete" | "rejected" | "not_configured";
export type ComplianceStatus = "pending" | "clear" | "review_required" | "blocked" | "expired";

export type MonetizationAccount = Readonly<{
  id: Uuid;
  subjectId: Uuid;
  programType: "creator" | "publisher";
  badgeStatus: "none" | "pending" | "active" | "suspended" | "revoked" | "expired";
  monetizationStatus: MonetizationStatus;
  payoutOnboardingStatus: PayoutOnboardingStatus;
  complianceStatus: ComplianceStatus;
  contractId: Uuid | null;
  activatedAt: IsoTimestamp | null;
  suspendedAt: IsoTimestamp | null;
}>;

export type RevenueLedgerEntry = Readonly<{
  id: Uuid;
  monetizationAccountId: Uuid;
  earningPeriodStart: IsoTimestamp;
  earningPeriodEnd: IsoTimestamp;
  netPayableMinor: number;
  currency: string;
  status: "pending" | "held" | "payable" | "paid" | "void" | "adjustment";
  createdAt: IsoTimestamp;
}>;
