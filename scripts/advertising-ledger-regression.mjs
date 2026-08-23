import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);

for (const name of [
  "advertiser_funding_accounts",
  "advertiser_funding_transactions",
  "campaign_budget_reservations",
  "ad_spend_ledger",
  "ADS_APPEND_ONLY",
  "record_ad_spend_charge",
  "reverse_invalid_ad_spend",
  "INSUFFICIENT_FUNDS",
  "BUDGET_EXHAUSTED",
  "CURRENCY_MISMATCH",
  "consumed_amount_minor <= amount_minor",
]) {
  if (!migration.includes(name)) throw new Error(`Missing ledger marker: ${name}`);
}

const first = domain.applySpendToReservation(1000, 0, 250);
if (first.consumed !== 250 || first.exhausted) throw new Error("partial consume failed");
const full = domain.applySpendToReservation(1000, 750, 250);
if (!full.exhausted) throw new Error("full consume should exhaust");
let overSpendBlocked = false;
try {
  domain.applySpendToReservation(1000, 900, 200);
} catch (error) {
  overSpendBlocked = error instanceof Error && error.message === "BUDGET_EXHAUSTED";
}
if (!overSpendBlocked) throw new Error("overspend must be blocked");

const shares = domain.computePartnerShares(100, 70, 30);
if (shares.platformShareMinor + shares.partnerShareMinor !== 100) throw new Error("share invariant failed");
const odd = domain.computePartnerShares(101, 70, 30);
if (odd.platformShareMinor + odd.partnerShareMinor !== 101) throw new Error("rounding invariant failed");

console.log("Advertising ledger regression passed.");
