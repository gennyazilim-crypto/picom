import assert from "node:assert/strict";
import { resolveAdEligibilityLocal } from "../src/domain/adEligibility.ts";
import { isAllowedVerifiedExternalUrl } from "../src/services/desktop/verifiedExternalUrlAllowlist.ts";

const placements = [
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
];

// A. Normal user — paid placements eligible when no ad_free and no server suppress
for (const placement of placements) {
  const decision = resolveAdEligibilityLocal({ placement });
  assert.equal(decision.eligible, true, `${placement} should be eligible for normal users`);
  assert.equal(decision.reason, "eligible_for_paid_placement");
}

// B. Active PICOM Verified (server decision wins)
for (const placement of placements) {
  const decision = resolveAdEligibilityLocal({
    placement,
    serverDecision: { eligible: false, reason: "ad_free_entitlement", placement },
    cachedAdFreeActive: false,
  });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, "ad_free_entitlement");
}

// Organic business remains visible (not treated as paid ad)
{
  const decision = resolveAdEligibilityLocal({
    placement: "feed",
    contentKind: "organic_business",
    serverDecision: null,
    cachedAdFreeActive: true,
    cachedAdFreeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, "not_paid_placement");
}

// C. Grace period via short cache
{
  const decision = resolveAdEligibilityLocal({
    placement: "companion_rail",
    cachedAdFreeActive: true,
    cachedAdFreeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, "ad_free_entitlement");
}

// D. Expired — ads reopen
{
  const decision = resolveAdEligibilityLocal({
    placement: "events",
    cachedAdFreeActive: true,
    cachedAdFreeExpiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  assert.equal(decision.eligible, true);
  assert.equal(decision.reason, "eligible_for_paid_placement");
}

// E. Client cache says active but server says expired — server wins
{
  const decision = resolveAdEligibilityLocal({
    placement: "feed_inline",
    cachedAdFreeActive: true,
    cachedAdFreeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    serverDecision: { eligible: true, reason: "eligible_for_paid_placement", placement: "feed_inline" },
  });
  assert.equal(decision.eligible, true);
  assert.equal(decision.reason, "eligible_for_paid_placement");
}

assert.equal(isAllowedVerifiedExternalUrl("https://checkout.stripe.com/c/pay/cs_test_123"), true);
assert.equal(isAllowedVerifiedExternalUrl("https://billing.stripe.com/session/test"), true);
assert.equal(isAllowedVerifiedExternalUrl("https://sandbox.iyzi.link/picom-verified-test"), true);
assert.equal(isAllowedVerifiedExternalUrl("https://account.picom.gg/verified"), true);
assert.equal(isAllowedVerifiedExternalUrl("javascript:alert(1)"), false);
assert.equal(isAllowedVerifiedExternalUrl("https://evil.example/phish"), false);
assert.equal(isAllowedVerifiedExternalUrl("file:///etc/passwd"), false);

console.log("verified-ad-free-leak-regression: PASS");
