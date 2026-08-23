import type { AdPlacement, AdEligibilityDecision, AdContentKind } from "../types/ads/adEligibility";

const PAID_PLACEMENTS = new Set<AdPlacement>([
  "feed",
  "feed_inline",
  "companion_rail",
  "community_rail",
  "live_now",
  "events",
  "profile",
  "search",
  "notification",
  "business_sponsored",
]);

const ORGANIC_KINDS = new Set<AdContentKind>([
  "organic_business",
  "organic_creator",
  "organic_publisher",
  "security_announcement",
  "service_announcement",
]);

export function resolveAdEligibilityLocal(input: {
  placement: string;
  contentKind?: string | null;
  serverDecision?: AdEligibilityDecision | null;
  cachedAdFreeActive?: boolean | null;
  cachedAdFreeExpiresAt?: string | null;
  now?: string;
}): AdEligibilityDecision {
  if (input.serverDecision) {
    return input.serverDecision;
  }

  const placement = input.placement.trim().toLowerCase() as AdPlacement;
  const contentKind = (input.contentKind ?? "").trim().toLowerCase() as AdContentKind;

  if (ORGANIC_KINDS.has(contentKind)) {
    return { eligible: false, reason: "not_paid_placement", placement, contentKind };
  }

  const now = Date.parse(input.now ?? new Date().toISOString());
  const cacheExpiry = input.cachedAdFreeExpiresAt ? Date.parse(input.cachedAdFreeExpiresAt) : null;
  const cacheValid =
    input.cachedAdFreeActive === true &&
    cacheExpiry !== null &&
    !Number.isNaN(now) &&
    !Number.isNaN(cacheExpiry) &&
    cacheExpiry > now;

  if (cacheValid) {
    return { eligible: false, reason: "ad_free_entitlement", placement };
  }

  if (!PAID_PLACEMENTS.has(placement)) {
    return { eligible: false, reason: "unknown_placement", placement };
  }

  return { eligible: true, reason: "eligible_for_paid_placement", placement };
}
