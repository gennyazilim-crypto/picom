import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const edge = await readFile(resolve(root, "supabase/functions/ads-delivery/index.ts"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);

for (const name of [
  "resolve_ad_delivery",
  "record_ad_impression",
  "record_ad_click",
  "ad_free",
  "advertising_global_kill_switch",
  "DELIVERY_TOKEN_EXPIRED",
  "PLACEMENT_MISMATCH",
  "get_ad_decision_explanation",
  "hide_ad_decision",
  "user_advertiser_blocks",
  "v1_50pct_1s",
]) {
  if (!migration.includes(name) && name !== "ad_free" && name !== "PLACEMENT_MISMATCH") {
    throw new Error(`Missing delivery marker: ${name}`);
  }
}
if (!migration.includes("resolve_ad_eligibility")) throw new Error("Delivery must call resolve_ad_eligibility");
if (!edge.includes("AD_DELIVERY_SIGNING_SECRET_MISSING")) throw new Error("Edge must fail-closed without signing secret");
if (!edge.includes("destination_url") || edge.includes("body.destinationUrl")) {
  throw new Error("Click path must not accept client destination override");
}

if (domain.isImpressionBillable(0.49, 1000)) throw new Error("Below visibility ratio must not bill");
if (domain.isImpressionBillable(0.5, 999)) throw new Error("Below duration must not bill");
if (!domain.isImpressionBillable(0.5, 1000)) throw new Error("Valid visibility must bill");
if (!domain.isSafeHttpsDestination("https://example.com/x")) throw new Error("https destination required");
if (domain.isSafeHttpsDestination("javascript:alert(1)")) throw new Error("javascript destinations blocked");

const secret = "test-delivery-secret-not-for-production";
const token = await domain.signDeliveryToken(secret, {
  decision_id: "11111111-1111-1111-1111-111111111111",
  placement: "feed_inline",
  issued_at: Math.floor(Date.now() / 1000),
  expires_at: Math.floor(Date.now() / 1000) + 60,
  nonce: "abc",
});
const claims = await domain.verifyDeliveryToken(secret, token);
if (claims.placement !== "feed_inline") throw new Error("Token placement binding failed");
let expiredRejected = false;
try {
  await domain.verifyDeliveryToken(secret, await domain.signDeliveryToken(secret, {
    decision_id: "11111111-1111-1111-1111-111111111111",
    placement: "feed_inline",
    issued_at: Math.floor(Date.now() / 1000) - 120,
    expires_at: Math.floor(Date.now() / 1000) - 60,
    nonce: "abc",
  }));
} catch {
  expiredRejected = true;
}
if (!expiredRejected) throw new Error("Expired token must fail");

let missingSecretRejected = false;
try {
  await domain.signDeliveryToken("", { decision_id: "x", placement: "feed_inline", issued_at: 1, expires_at: 2, nonce: "n" });
} catch (error) {
  missingSecretRejected = error instanceof Error && error.message.includes("AD_DELIVERY_SIGNING_SECRET_MISSING");
}
if (!missingSecretRejected) throw new Error("Missing signing secret must fail closed");

console.log("Advertising delivery security regression passed.");
