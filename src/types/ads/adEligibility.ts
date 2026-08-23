export type AdPlacement =
  | "feed"
  | "feed_inline"
  | "companion_rail"
  | "community_rail"
  | "live_now"
  | "events"
  | "profile"
  | "search"
  | "notification"
  | "business_sponsored";

export type AdContentKind =
  | "paid_ad"
  | "sponsored_feed_card"
  | "boosted_business_post"
  | "organic_business"
  | "organic_creator"
  | "organic_publisher"
  | "security_announcement"
  | "service_announcement";

export type AdEligibilityDecision = Readonly<{
  eligible: boolean;
  reason: "ad_free_entitlement" | "not_paid_placement" | "unknown_placement" | "eligible_for_paid_placement";
  placement: string;
  contentKind?: string;
}>;
