import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = {
  checkout: readFileSync(resolve("supabase/functions/billing-checkout/index.ts"), "utf8"),
  portal: readFileSync(resolve("supabase/functions/billing-portal/index.ts"), "utf8"),
  webhook: readFileSync(resolve("supabase/functions/billing-webhook/index.ts"), "utf8"),
  verification: readFileSync(resolve("supabase/functions/verification-account-session/index.ts"), "utf8"),
  allowlist: readFileSync(resolve("supabase/functions/_shared/billing-allowlist.ts"), "utf8"),
  stripe: readFileSync(resolve("supabase/functions/_shared/billing-stripe.ts"), "utf8"),
  config: readFileSync(resolve("supabase/config.toml"), "utf8"),
};

assert.match(files.config, /\[functions\.billing-webhook\][\s\S]*verify_jwt = false/);
assert.match(files.config, /\[functions\.billing-checkout\][\s\S]*verify_jwt = true/);
assert.match(files.checkout, /requireSupabaseUser/);
assert.match(files.checkout, /isPicomVerifiedPlanKey/);
assert.match(files.checkout, /buildAbsoluteReturnUrl/);
assert.match(files.portal, /isAllowedPortalHost/);
assert.match(files.webhook, /verifyStripeWebhookSignature/);
assert.match(files.webhook, /HANDLED/);
assert.match(files.webhook, /identity\.verification_session\.verified/);
assert.match(files.verification, /NOT_CONFIGURED/);
assert.match(files.allowlist, /ALLOWED_RETURN_PATHS/);
assert.match(files.stripe, /BILLING_PROVIDER/);
assert.match(files.stripe, /STRIPE_SECRET_KEY/);
assert.doesNotMatch(files.checkout, /VITE_STRIPE/);
assert.doesNotMatch(files.webhook, /console\.log\(rawBody\)/);

console.log("picom-verified-edge-contract-test: PASS");
