import type { IsoTimestamp, Uuid } from "./shared";
import type { VerificationSubjectType } from "./verification";

export type AdvertiserType = "individual" | "sole_trader" | "company" | "agency" | "business_partner";
export type AdvertisingStatus = "pending" | "active" | "suspended" | "revoked";

export type AdvertiserAccount = Readonly<{
  id: Uuid;
  ownerType: VerificationSubjectType;
  ownerId: Uuid;
  advertiserType: AdvertiserType;
  displayName: string;
  billingStatus: "unconfigured" | "pending" | "active" | "past_due" | "suspended";
  verificationStatus: "unverified" | "pending" | "verified" | "rejected" | "expired";
  advertisingStatus: AdvertisingStatus;
  riskStatus: "unknown" | "clear" | "review_required" | "blocked";
  createdAt: IsoTimestamp;
}>;
