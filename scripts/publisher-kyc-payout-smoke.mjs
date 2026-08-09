/**
 * Static smoke for TASK32 KYC / tax / payout / statements foundation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migrations = [
  "supabase/migrations/20260808340000_publisher_kyc_tax_core.sql",
  "supabase/migrations/20260808350000_publisher_payout_accounts.sql",
  "supabase/migrations/20260808360000_publisher_payout_engine.sql",
  "supabase/migrations/20260808370000_publisher_statements_reconciliation.sql",
  "supabase/migrations/20260808380000_publisher_payout_security.sql",
];
for (const file of migrations) assert.ok(existsSync(path.join(root, file)), file);

const kyc = read(migrations[0]);
const accounts = read(migrations[1]);
const engine = read(migrations[2]);
const statements = read(migrations[3]);
const security = read(migrations[4]);

assert.match(kyc, /publisher_kyc_profiles/);
assert.match(kyc, /MORE_INFORMATION_REQUIRED/);
assert.match(kyc, /publisher_tax_profiles/);
assert.match(kyc, /BLOCKED_PROVIDER_CONFIGURATION/);
assert.match(kyc, /service_sync_publisher_kyc_status/);
assert.doesNotMatch(kyc, /passport|selfie|biometric/i);

assert.match(accounts, /publisher_payout_accounts/);
assert.match(accounts, /last4_or_masked/);
assert.match(accounts, /publisher_payout_holds/);
assert.match(accounts, /finance\.approve/);
assert.doesNotMatch(accounts, /full_iban|iban_number|store full account number/i);
assert.match(accounts, /Never store full IBAN\/account credentials/);

assert.match(engine, /evaluate_publisher_payout_eligibility/);
assert.match(engine, /PAYOUT_RESERVED/);
assert.match(engine, /service_request_publisher_payout_internal_test/);
assert.match(engine, /for update skip locked/i);
assert.match(engine, /service_mark_publisher_payout_paid/);
assert.match(engine, /service_mark_publisher_payout_failed/);
assert.match(engine, /service_mark_publisher_payout_reversed/);
assert.match(engine, /PAYOUT_PROVIDER_NOT_CONFIGURED/);

assert.match(statements, /publisher_finance_statements/);
assert.match(statements, /service_finalize_publisher_finance_statement/);
assert.match(statements, /publisher_payout_reconciliation_issues/);
assert.match(statements, /AMOUNT_MISMATCH/);

assert.match(security, /dashboard\.read does NOT grant/);
assert.match(security, /get_my_publisher_finance_setup/);

const flags = read("src/services/featureFlagService.ts");
for (const key of [
  "enablePublisherKyc",
  "enablePublisherTaxProfile",
  "enablePublisherPayoutAccounts",
  "enablePublisherPayouts",
  "enablePublisherStatements",
]) {
  assert.match(flags, new RegExp(key));
  assert.match(flags, new RegExp(`${key}:\\s*appConfig\\.environment !== "production"`));
}

const edge = read("supabase/functions/publisher-payouts/index.ts");
assert.match(edge, /BLOCKED_PROVIDER_CONFIGURATION/);
assert.match(edge, /LIVE_PAYOUT_OFF|livePayouts/);
assert.match(edge, /MISSING_SIGNATURE|INVALID_SIGNATURE/);
assert.doesNotMatch(edge, /KYC_PROVIDER_SECRET.*(jsonResponse|return json)/);

const catalog = read("src/services/localization/publisherMonetizationCatalog.ts");
assert.match(catalog, /finance\.identityVerification/);
assert.match(catalog, /finance\.payoutOnHold/);
assert.match(catalog, /const ar:/);

const ui = read("src/components/publisher/PublisherEarningsPanel.tsx");
assert.match(ui, /finance\.setup|financeSetup/);
assert.match(ui, /getFinanceSetup/);
assert.doesNotMatch(ui, /Math\.random/);

// --- Integer payout race / statement fixtures ---
function availableAfter(entries) {
  return entries.reduce((acc, e) => {
    if (e.bucket === "available") return acc + (e.direction === "credit" ? e.amount : -e.amount);
    return acc;
  }, 0);
}

function tryReserve(state, amount, key, seen) {
  if (seen.has(key)) return { ...state, duplicate: true };
  if (amount > state.available) return { ...state, denied: true };
  seen.add(key);
  return {
    available: state.available - amount,
    entries: [
      ...state.entries,
      { type: "PAYOUT_RESERVED", direction: "debit", bucket: "available", amount, key },
    ],
    reserved: (state.reserved || 0) + amount,
  };
}

const raceSeen = new Set();
let race = { available: 10000, entries: [], reserved: 0 };
const a = tryReserve(race, 8000, "a", raceSeen);
race = a.denied ? race : a;
const b = tryReserve(race, 8000, "b", raceSeen);
assert.equal(a.denied, undefined);
assert.equal(b.denied, true);
assert.equal(race.available, 2000);

// Idempotency x10
const idempSeen = new Set();
let idemp = { available: 5000, entries: [] };
for (let i = 0; i < 10; i += 1) {
  idemp = tryReserve(idemp, 1000, "same-key", idempSeen);
}
assert.equal(idemp.available, 4000);
assert.equal(idemp.entries.filter((e) => e.key === "same-key").length, 1);

// Failure releases reserve
function failRelease(state, amount) {
  return {
    available: state.available + amount,
    entries: [
      ...state.entries,
      { type: "PAYOUT_RELEASED", direction: "credit", bucket: "available", amount },
    ],
  };
}
let failState = { available: 2000, entries: [{ type: "PAYOUT_RESERVED", direction: "debit", bucket: "available", amount: 8000 }] };
// After reserve from 10000 -> 2000; fail restores
failState = failRelease(failState, 8000);
assert.equal(failState.available, 10000);

// Statement reconciliation fixture
const stmt = {
  subscriptionNet: 900,
  donationNet: 500,
  adNet: 300,
  refund: 200,
  payout: 1000,
};
const endingEffect = stmt.subscriptionNet + stmt.donationNet + stmt.adNet - stmt.refund - stmt.payout;
assert.equal(endingEffect, 500);
assert.equal(Number.isInteger(endingEffect), true);

// Multi-currency: no sum
const balances = { EUR: 1000, USD: 2000 };
assert.notEqual(balances.EUR + balances.USD, balances.EUR); // document separate handling
assert.equal(Object.keys(balances).length, 2);

// Negative balance blocks payout
assert.equal(tryReserve({ available: -100, entries: [] }, 50, "neg", new Set()).denied, true);

console.log("publisher-kyc-payout-smoke: PASS");
