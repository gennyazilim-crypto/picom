import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/monetization/payoutDomain.ts")).href);

for (const marker of [
  "payout_batches",
  "payout_items",
  "payout_item_accruals",
  "PAYOUT_APPEND_ONLY",
  "create_payout_batch",
  "preview_payout_batch",
  "mutates_state', false",
  "DUAL_APPROVAL_REQUIRED",
  "financial_adjustments",
  "financial_reconciliation_runs",
  "for update skip locked",
  "compute_partner_balance",
]) {
  if (!migration.includes(marker)) throw new Error(`Missing ledger marker: ${marker}`);
}

domain.assertPayoutNetInvariant({ gross: 1000, reserve: 100, withholding: 50, fees: 25, net: 825 });
let invariantBlocked = false;
try {
  domain.assertPayoutNetInvariant({ gross: 100, reserve: 0, withholding: 0, fees: 0, net: 50 });
} catch (error) {
  invariantBlocked = error instanceof Error && error.message === "PAYOUT_NET_INVARIANT";
}
if (!invariantBlocked) throw new Error("net invariant mismatch must fail");
let negativeBlocked = false;
try {
  domain.assertPayoutNetInvariant({ gross: 100, reserve: 0, withholding: 0, fees: 0, net: -1 });
} catch (error) {
  negativeBlocked = error instanceof Error && (error.message === "NET_INVALID" || error.message === "NEGATIVE_NET_PAYOUT");
}
if (!negativeBlocked) throw new Error("negative net must fail");

const available = domain.deriveAvailableBalance({
  availableAccrualsMinor: 1000,
  activeReservesMinor: 100,
  withholdingMinor: 50,
  reservedForPayoutMinor: 200,
  reversalsMinor: 0,
  pendingReturnsMinor: 0,
});
if (available !== 650) throw new Error("available balance derivation failed");

let negBal = false;
try {
  domain.deriveAvailableBalance({
    availableAccrualsMinor: 10,
    activeReservesMinor: 20,
    withholdingMinor: 0,
    reservedForPayoutMinor: 0,
    reversalsMinor: 0,
    pendingReturnsMinor: 0,
  });
} catch (error) {
  negBal = error instanceof Error && error.message === "NEGATIVE_AVAILABLE_BALANCE";
}
if (!negBal) throw new Error("negative available must fail closed");

if (domain.canMapAccrualToPayoutItem("paid")) throw new Error("paid accrual must not remap");
if (domain.dualApprovalBlocked("a", "a", true) !== true) throw new Error("dual approval self-approve must block");
if (domain.dualApprovalBlocked("a", "b", true) !== false) throw new Error("distinct approver should pass");

console.log("Payout ledger regression passed.");
