import type { IsoTimestamp, Uuid } from "./shared";
import type { VerificationSubjectType } from "./verification";

export type EntitlementKey = "ad_free" | "verified_badge_eligible" | "priority_support" | "creator_analytics" | "publisher_analytics" | "monetization" | "business_dashboard" | "advertiser_dashboard";
export type EntitlementStatus = "pending" | "active" | "grace_period" | "suspended" | "expired" | "revoked";

export type AccountEntitlement = Readonly<{
  id: Uuid;
  subjectType: VerificationSubjectType;
  subjectId: Uuid;
  entitlementKey: EntitlementKey;
  status: EntitlementStatus;
  startsAt: IsoTimestamp | null;
  endsAt: IsoTimestamp | null;
  graceUntil: IsoTimestamp | null;
  version: number;
}>;
