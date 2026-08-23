import assert from "node:assert/strict";
import { resolvePublicBadges } from "../src/domain/publicBadgeResolver.ts";
import {
  canDisplayBadgeWithoutPayout,
  canReceivePayout,
  isEntitlementCurrentlyUsable,
} from "../src/domain/verificationBusinessLifecycle.ts";

const verifiedBadge = {
  id: "badge-verified",
  subjectType: "user",
  subjectId: "user-1",
  badgeType: "verified",
  status: "active",
  issuedAt: "2026-08-03T00:00:00.000Z",
  expiresAt: null,
  publicReasonCode: null,
  isPrimary: false,
};

const creatorBadge = {
  ...verifiedBadge,
  id: "badge-creator",
  badgeType: "creator",
  issuedAt: "2026-08-02T00:00:00.000Z",
  isPrimary: true,
};

const resolution = resolvePublicBadges({
  subjectType: "user",
  subjectId: "user-1",
  badges: [creatorBadge, verifiedBadge],
  businessAffiliation: { organizationId: "org-1", displayName: "Picom Studio" },
});
assert.equal(resolution.primaryBadge.id, "badge-creator");
assert.deepEqual(
  resolution.secondaryBadges.map((badge) => badge.id),
  ["badge-verified"],
);
assert.equal(resolution.verificationDisplayState, "verified");
assert.equal(resolution.frameVariant, "signature");
assert.equal(
  resolution.accessibilityLabel,
  "creator badge, verified badge; affiliated with Picom Studio",
);

const businessResolution = resolvePublicBadges({
  subjectType: "organization",
  subjectId: "org-1",
  badges: [
    {
      ...verifiedBadge,
      id: "badge-business",
      subjectType: "organization",
      subjectId: "org-1",
      badgeType: "business",
    },
  ],
  businessAffiliation: { organizationId: "org-1", displayName: "Picom Studio" },
});
assert.equal(businessResolution.businessAffiliation, null);
assert.equal(businessResolution.frameVariant, "minimal");
assert.equal(businessResolution.accessibilityLabel, "business badge");

const emptyResolution = resolvePublicBadges({
  subjectType: "user",
  subjectId: "user-2",
  badges: [verifiedBadge],
});
assert.equal(emptyResolution.primaryBadge, null);
assert.equal(emptyResolution.verificationDisplayState, "unverified");
assert.equal(emptyResolution.frameVariant, "minimal");

assert.equal(
  isEntitlementCurrentlyUsable({
    status: "active",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2027-01-01T00:00:00.000Z",
    graceUntil: null,
    now: "2026-08-03T00:00:00.000Z",
  }),
  true,
);
assert.equal(
  isEntitlementCurrentlyUsable({
    status: "grace_period",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-07-01T00:00:00.000Z",
    graceUntil: "2026-08-10T00:00:00.000Z",
    now: "2026-08-03T00:00:00.000Z",
  }),
  true,
);
assert.equal(
  isEntitlementCurrentlyUsable({
    status: "grace_period",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-07-01T00:00:00.000Z",
    graceUntil: "2026-08-01T00:00:00.000Z",
    now: "2026-08-03T00:00:00.000Z",
  }),
  false,
);
assert.equal(
  isEntitlementCurrentlyUsable({
    status: "revoked",
    startsAt: null,
    endsAt: null,
    graceUntil: null,
  }),
  false,
);

assert.equal(
  canReceivePayout({
    badgeStatus: "active",
    monetizationStatus: "pending",
    payoutOnboardingStatus: "incomplete",
    complianceStatus: "pending",
  }),
  false,
);
assert.equal(
  canDisplayBadgeWithoutPayout({
    badgeStatus: "active",
    monetizationStatus: "pending",
    payoutOnboardingStatus: "incomplete",
    complianceStatus: "pending",
  }),
  true,
);
assert.equal(
  canReceivePayout({
    badgeStatus: "active",
    monetizationStatus: "active",
    payoutOnboardingStatus: "complete",
    complianceStatus: "clear",
  }),
  true,
);

// Public / admin DTO separation: public badge type must not accept internalReasonCode.
const publicBadgeKeys = Object.keys(verifiedBadge).sort();
assert.deepEqual(publicBadgeKeys, [
  "badgeType",
  "expiresAt",
  "id",
  "isPrimary",
  "issuedAt",
  "publicReasonCode",
  "status",
  "subjectId",
  "subjectType",
]);
assert.equal("internalReasonCode" in verifiedBadge, false);

console.log("Verification business domain contract test passed.");
