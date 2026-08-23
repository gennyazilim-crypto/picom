import type { IsoTimestamp, Uuid } from "./shared";
import type { VerificationSubjectType } from "./verification";

export type AdvertiserType = "individual" | "sole_trader" | "company" | "agency" | "business_partner";
export type AdvertisingStatus =
  | "draft"
  | "pending"
  | "pending_verification"
  | "active"
  | "limited"
  | "suspended"
  | "revoked";

export type AdvertiserBillingStatus =
  | "unconfigured"
  | "not_configured"
  | "pending"
  | "funded"
  | "payment_required"
  | "active"
  | "past_due"
  | "blocked"
  | "suspended";

export type AdvertiserRiskStatus =
  | "unknown"
  | "normal"
  | "clear"
  | "review_required"
  | "restricted"
  | "high_risk"
  | "blocked";

export type AdvertiserMemberRole =
  | "owner"
  | "advertiser_owner"
  | "advertiser_admin"
  | "billing_manager"
  | "campaign_manager"
  | "creative_manager"
  | "analyst"
  | "compliance_contact";

export type CampaignObjective =
  | "awareness"
  | "reach"
  | "traffic"
  | "engagement"
  | "video_views"
  | "profile_visits"
  | "product_views"
  | "event_interest"
  | "app_install"
  | "lead_generation";

export type CampaignStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "requires_changes"
  | "approved"
  | "scheduled"
  | "active"
  | "paused"
  | "budget_exhausted"
  | "completed"
  | "rejected"
  | "suspended"
  | "cancelled"
  | "archived";

export type AdvertiserAccount = Readonly<{
  id: Uuid;
  ownerType: VerificationSubjectType;
  ownerId: Uuid;
  advertiserType: AdvertiserType;
  displayName: string;
  billingStatus: AdvertiserBillingStatus;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected" | "expired";
  advertisingStatus: AdvertisingStatus;
  riskStatus: AdvertiserRiskStatus;
  createdAt: IsoTimestamp;
}>;

export type PublicAdCreativeDto = Readonly<{
  sponsored: true;
  label: "Sponsored";
  advertiserName: string;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  destinationDomain: string | null;
  placement: string;
  decisionId: Uuid;
  snapshotId: Uuid;
  explanationFactors: readonly string[];
}>;

export type AdDeliveryResolveResult = Readonly<{
  eligible: boolean;
  reason: string;
  requestId: string;
  decisionId?: Uuid;
  expiresAt?: IsoTimestamp;
  creative?: PublicAdCreativeDto;
}>;
