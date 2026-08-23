import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);

for (const name of [
  "ad_partner_attributions",
  "partner_revenue_accruals",
  "attribute_partner_ad_revenue",
  "reconcile_ad_revenue_period",
  "PARTNER_MONETIZATION_INACTIVE",
  "PARTNER_SELF_TRAFFIC",
  "REVENUE_CONTRACT_INACTIVE",
  "PARTNER_ATTRIBUTION_INVALID_TRAFFIC",
  "platform_share_minor + partner_share_minor = eligible_revenue_minor",
  "AD_RECONCILIATION_DISABLED",
]) {
  if (!migration.includes(name)) throw new Error(`Missing partner attribution marker: ${name}`);
}
if (migration.includes("payout_sent") || migration.includes("transfer_funds")) {
  throw new Error("Real payout send must not be claimed in this migration");
}

const shares = domain.computePartnerShares(1000, 65, 35);
if (shares.platformShareMinor !== 650 || shares.partnerShareMinor !== 350) {
  throw new Error("contract percentage mapping incorrect");
}

console.log("Partner revenue attribution regression passed.");
