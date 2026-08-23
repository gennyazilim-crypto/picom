import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/monetization/payoutDomain.ts")).href);

for (const marker of [
  "create_monetization_application",
  "resolve_payout_eligibility",
  "CLIENT_CANNOT_ACTIVATE_MONETIZATION",
  "CLIENT_CANNOT_COMPLETE_PAYOUT_ONBOARDING",
  "CLIENT_CANNOT_VERIFY_TAX",
  "LEGAL_COPY_REQUIRED",
  "payout_require_active_legal",
  "tax_information_required",
  "minimum_payout_not_reached",
  "global_payouts_enabled",
]) {
  if (!migration.includes(marker)) throw new Error(`Missing contract marker: ${marker}`);
}

if (!domain.badgeDoesNotGrantPayout("active", "pending", false)) {
  throw new Error("badge must not grant payout");
}
if (!domain.monetizationDoesNotGrantPayout("active", "incomplete")) {
  throw new Error("monetization active without payout onboarding must not imply payout");
}
if (domain.isAccrualBatchEligible("held")) throw new Error("held accrual must not be batch eligible");
if (domain.isAccrualBatchEligible("available", "invalid")) throw new Error("invalid traffic must not be batch eligible");
if (!domain.isAccrualBatchEligible("available", "clean")) throw new Error("available clean should be eligible");

const shares = domain.computeSharesFromBasisPoints(101, 7000, 3000);
if (shares.platformShareMinor + shares.partnerShareMinor !== 101) throw new Error("bps share invariant failed");

console.log("Monetization payout contract regression passed.");
