import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAdEligibilityLocal } from "../src/domain/adEligibility.ts";
import { resolvePublicBadges } from "../src/domain/publicBadgeResolver.ts";

const allowlist = readFileSync(resolve("supabase/functions/_shared/billing-allowlist.ts"), "utf8");
assert.match(allowlist, /isAllowedReturnPath/);
assert.match(allowlist, /\/verified\/status/);
assert.match(allowlist, /checkout\.stripe\.com/);

const checkout = readFileSync(resolve("supabase/functions/billing-checkout/index.ts"), "utf8");
assert.match(checkout, /Client-supplied price identifiers are not accepted/);
assert.match(checkout, /NOT_CONFIGURED/);
assert.match(checkout, /idempotencyKey/);

const webhook = readFileSync(resolve("supabase/functions/billing-webhook/index.ts"), "utf8");
assert.match(webhook, /verifyStripeWebhookSignature/);
assert.match(webhook, /reconcile_picom_verified_entitlements/);
assert.match(webhook, /duplicate/);
assert.match(webhook, /provider_state_version/);
assert.doesNotMatch(webhook, /smtp|nodemailer|sendMail/i);

const migration = readFileSync(resolve("supabase/migrations/20260803210000_picom_verified_subscription_and_entitlements.sql"), "utf8");
assert.match(migration, /reconcile_picom_verified_entitlements/);
assert.match(migration, /reconcile_verified_account_badge/);
assert.match(migration, /resolve_ad_eligibility/);
assert.match(migration, /PICOM_VERIFIED_HISTORY_APPEND_ONLY/);
assert.match(migration, /billing_catalog_public/);

// Grace / expiry local mirror
assert.equal(
  resolveAdEligibilityLocal({
    placement: "live_now",
    cachedAdFreeActive: true,
    cachedAdFreeExpiresAt: new Date(Date.now() + 5_000).toISOString(),
  }).reason,
  "ad_free_entitlement",
);

// Creator + Verified coexistence
const resolution = resolvePublicBadges({
  subjectType: "user",
  subjectId: "u1",
  badges: [
    {
      id: "c1",
      subjectType: "user",
      subjectId: "u1",
      badgeType: "creator",
      status: "active",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      publicReasonCode: null,
      isPrimary: true,
    },
    {
      id: "v1",
      subjectType: "user",
      subjectId: "u1",
      badgeType: "verified",
      status: "active",
      issuedAt: "2026-02-01T00:00:00.000Z",
      expiresAt: null,
      publicReasonCode: "verified_account",
      isPrimary: false,
    },
  ],
});
assert.equal(resolution.primaryBadge?.id, "c1");
assert.equal(resolution.secondaryBadges[0]?.id, "v1");
assert.equal(resolution.frameVariant, "signature");

console.log("picom-verified-domain-contract-test: PASS");
