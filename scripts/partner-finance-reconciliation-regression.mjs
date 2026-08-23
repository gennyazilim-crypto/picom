import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const adsMigration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const payoutMigration = await readFile(resolve(root, "supabase/migrations/20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"), "utf8");
const adDomain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);
const payoutDomain = await import(pathToFileURL(resolve(root, "src/services/monetization/payoutDomain.ts")).href);

for (const marker of [
  "ad_spend_ledger",
  "ad_partner_attributions",
  "partner_revenue_accruals",
  "attribute_partner_ad_revenue",
  "reverse_invalid_ad_spend",
]) {
  if (!adsMigration.includes(marker)) throw new Error(`Missing ads finance marker: ${marker}`);
}

for (const marker of [
  "financial_reconciliation_runs",
  "financial_reconciliation_findings",
  "variance_found",
  "payout_item_accruals",
  "platform_percentage_basis_points",
]) {
  if (!payoutMigration.includes(marker)) throw new Error(`Missing reconciliation marker: ${marker}`);
}

// Do not create a second spend ledger.
if ((payoutMigration.match(/create table if not exists public\.ad_spend_ledger/g) || []).length > 0) {
  throw new Error("must not recreate ad_spend_ledger");
}

const percentShares = adDomain.computePartnerShares(100, 70, 30);
if (percentShares.platformShareMinor + percentShares.partnerShareMinor !== 100) throw new Error("percent share invariant");

const bpsShares = payoutDomain.computeSharesFromBasisPoints(100, 7000, 3000);
if (bpsShares.platformShareMinor + bpsShares.partnerShareMinor !== 100) throw new Error("bps share invariant");
if (bpsShares.partnerShareMinor !== percentShares.partnerShareMinor) throw new Error("bps/percent partner share mismatch for 70/30");

if (payoutDomain.isAccrualBatchEligible("available", "invalid")) {
  throw new Error("invalid traffic must not enter payout batch");
}

console.log("Partner finance reconciliation regression passed.");
console.log("PROVIDER RECONCILIATION WITH LIVE DATA: BLOCKED");
