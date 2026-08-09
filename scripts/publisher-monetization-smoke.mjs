/**
 * Static smoke for TASK31 publisher monetization foundation.
 * Integer money math, ledger reconciliation fixtures, immutability/idempotency markers.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migrations = [
  "supabase/migrations/20260808300000_publisher_monetization_core.sql",
  "supabase/migrations/20260808310000_publisher_revenue_ledger.sql",
  "supabase/migrations/20260808320000_publisher_monetization_security.sql",
  "supabase/migrations/20260808330000_publisher_entitlements.sql",
];
for (const file of migrations) assert.ok(existsSync(path.join(root, file)), file);

const core = read(migrations[0]);
const ledger = read(migrations[1]);
const security = read(migrations[2]);
const entitlements = read(migrations[3]);

assert.match(core, /eligibility_status/);
assert.match(core, /publisher_subscription_products/);
assert.match(core, /publisher_donations/);
assert.match(core, /publisher_ad_revenue_attributions/);
assert.match(core, /amount_minor/);
assert.doesNotMatch(core, /double precision|real\b|float\b/i);
assert.match(core, /compute_publisher_monetization_eligibility/);

assert.match(ledger, /publisher_finance_ledger_entries/);
assert.match(ledger, /PUBLISHER_FINANCE_LEDGER_APPEND_ONLY/);
assert.match(ledger, /service_record_subscription_revenue/);
assert.match(ledger, /service_record_donation_revenue/);
assert.match(ledger, /service_record_ad_revenue/);
assert.match(ledger, /service_record_refund/);
assert.match(ledger, /service_record_chargeback/);
assert.match(ledger, /idempotency_key/);
assert.match(ledger, /grant execute on function public\.service_record_subscription_revenue[\s\S]{0,200}to service_role/);
assert.match(ledger, /revoke all on function public\.service_record_subscription_revenue[\s\S]{0,200}from public, anon, authenticated/);

assert.match(security, /get_publisher_earnings_overview/);
assert.match(security, /dashboard\.read does NOT grant/);
assert.match(security, /finance\.read/);
assert.match(security, /publisher_finance_ledger_finance_select/);

assert.match(entitlements, /publisher_subscription_entitlements/);
assert.match(entitlements, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
assert.match(entitlements, /request_cancel_publisher_subscription/);

const flags = read("src/services/featureFlagService.ts");
for (const key of [
  "enablePublisherMonetization",
  "enablePublisherSubscriptions",
  "enablePublisherDonations",
  "enablePublisherAdRevenue",
  "enablePublisherEarningsDashboard",
]) {
  assert.match(flags, new RegExp(key));
  assert.match(flags, new RegExp(`${key}:\\s*appConfig\\.environment !== "production"`));
}

const edge = read("supabase/functions/publisher-payments/index.ts");
assert.match(edge, /BLOCKED_PROVIDER_CONFIGURATION/);
assert.match(edge, /MISSING_SIGNATURE|INVALID_SIGNATURE/);
assert.match(edge, /PAYMENT_WEBHOOK_SECRET/);
assert.doesNotMatch(edge, /PAYMENT_PROVIDER_SECRET.*(jsonResponse|return json)/);

const catalog = read("src/services/localization/publisherMonetizationCatalog.ts");
assert.match(catalog, /earnings\.payoutsUnavailable/);
assert.match(catalog, /const ar:/);
assert.match(catalog, /const ja:/);

const ui = read("src/components/publisher/PublisherEarningsPanel.tsx");
assert.match(ui, /enablePublisherEarningsDashboard/);
assert.match(ui, /payoutsUnavailable/);
assert.doesNotMatch(ui, /Math\.random/);

// --- Integer ledger reconciliation fixtures (canonical test policy) ---
function recordSubscription({ gross, platformFee, providerFee }) {
  const net = gross - platformFee - providerFee;
  assert.ok(net >= 0);
  return {
    entries: [
      { type: "SUBSCRIPTION_GROSS", direction: "credit", bucket: "non_balance", amount: gross },
      ...(platformFee > 0
        ? [{ type: "SUBSCRIPTION_PLATFORM_FEE", direction: "debit", bucket: "non_balance", amount: platformFee }]
        : []),
      ...(providerFee > 0
        ? [{ type: "SUBSCRIPTION_PROVIDER_FEE", direction: "debit", bucket: "non_balance", amount: providerFee }]
        : []),
      ...(net > 0
        ? [{ type: "SUBSCRIPTION_NET", direction: "credit", bucket: "available", amount: net }]
        : []),
    ],
    net,
  };
}

function applyRefund(state, netReversal) {
  return {
    entries: [
      ...state.entries,
      { type: "REFUND", direction: "debit", bucket: "refunded_or_reversed", amount: netReversal },
    ],
  };
}

function applyChargeback(state, netReversal) {
  return {
    entries: [
      ...state.entries,
      { type: "CHARGEBACK", direction: "debit", bucket: "refunded_or_reversed", amount: netReversal },
    ],
  };
}

function availableBalance(entries) {
  return entries.reduce((acc, e) => {
    if (e.bucket === "available") {
      return acc + (e.direction === "credit" ? e.amount : -e.amount);
    }
    if (e.bucket === "refunded_or_reversed") {
      return acc + (e.direction === "credit" ? e.amount : -e.amount);
    }
    return acc;
  }, 0);
}

function idempotentReplay(fn, times) {
  let last = null;
  for (let i = 0; i < times; i += 1) {
    const next = fn();
    if (last) assert.deepEqual(next, last);
    last = next;
  }
  return last;
}

// Fixture: gross 1000, platform 100, publisher 900
const sub = recordSubscription({ gross: 1000, platformFee: 100, providerFee: 0 });
assert.equal(sub.net, 900);
assert.equal(availableBalance(sub.entries), 900);

const refunded = applyRefund(sub, 900);
assert.equal(availableBalance(refunded.entries), 0);

const charged = applyChargeback(sub, 900);
assert.equal(availableBalance(charged.entries), 0);

// Chargeback can go negative if already paid out conceptually
const overCharge = applyChargeback(sub, 1200);
assert.equal(availableBalance(overCharge.entries), -300);

// Ad attribution: valid impressions only settle creator share
function settleAd({ impressionsValid, gross, creatorShare, platformShare, trafficStatus }) {
  assert.equal(creatorShare + platformShare, gross);
  if (trafficStatus !== "VALID" || impressionsValid <= 0) {
    return { settledCreator: 0 };
  }
  return { settledCreator: creatorShare };
}
assert.equal(settleAd({ impressionsValid: 100, gross: 1000, creatorShare: 700, platformShare: 300, trafficStatus: "VALID" }).settledCreator, 700);
assert.equal(settleAd({ impressionsValid: 100, gross: 1000, creatorShare: 700, platformShare: 300, trafficStatus: "INVALID" }).settledCreator, 0);

// Idempotency: same economic result x2 / x10
idempotentReplay(() => recordSubscription({ gross: 1000, platformFee: 100, providerFee: 0 }), 2);
idempotentReplay(() => recordSubscription({ gross: 1000, platformFee: 100, providerFee: 0 }), 10);
idempotentReplay(() => applyRefund(sub, 900), 2);
idempotentReplay(() => applyChargeback(sub, 900), 2);
idempotentReplay(
  () => settleAd({ impressionsValid: 100, gross: 500, creatorShare: 350, platformShare: 150, trafficStatus: "VALID" }),
  2,
);

// Money must stay integer
assert.equal(Number.isInteger(sub.net), true);
assert.equal(Number.isInteger(availableBalance(refunded.entries)), true);

const i18n = read("src/services/localization/publisherMonetizationCatalog.ts");
const locales = ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"];
for (const loc of locales) assert.match(i18n, new RegExp(`const ${loc}:`));

console.log("publisher-monetization-smoke: PASS");
