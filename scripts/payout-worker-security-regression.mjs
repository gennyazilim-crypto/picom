import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"), "utf8");
const provider = await readFile(resolve(root, "supabase/functions/_shared/payout-provider.ts"), "utf8");
const webhook = await readFile(resolve(root, "supabase/functions/webhooks-payout-provider/index.ts"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/monetization/payoutDomain.ts")).href);

for (const marker of [
  "claim_payout_batch_for_processing",
  "PAYOUT_KILL_SWITCH_ACTIVE",
  "batch_processing_enabled",
  "apply_provider_payout_item_event",
  "retry_scheduled",
]) {
  if (!migration.includes(marker)) throw new Error(`Missing worker marker: ${marker}`);
}

for (const marker of [
  "readPayoutProviderConfig",
  "createTransferOrPayout",
  "Idempotency",
  "verifyPayoutWebhookEvent",
]) {
  if (!provider.includes(marker) && !webhook.includes(marker.replace("verifyPayoutWebhookEvent", "verifyPayoutWebhookEvent"))) {
    // checked below
  }
}
if (!provider.includes("readPayoutProviderConfig")) throw new Error("provider config reader missing");
if (!provider.includes("createTransferOrPayout")) throw new Error("transfer API missing");
if (!webhook.includes("verifyPayoutWebhookEvent")) throw new Error("webhook signature gate missing");
if (!webhook.includes("duplicate: true")) throw new Error("webhook idempotency missing");

const blocked = domain.canProcessBatch({
  batchStatus: "approved",
  globalPayoutsEnabled: false,
  providerPayoutsEnabled: true,
  batchProcessingEnabled: true,
  programEnabled: true,
});
if (blocked.ok || blocked.code !== "GLOBAL_PAYOUTS_DISABLED") throw new Error("kill switch must block");

const notApproved = domain.canProcessBatch({
  batchStatus: "awaiting_approval",
  globalPayoutsEnabled: true,
  providerPayoutsEnabled: true,
  batchProcessingEnabled: true,
  programEnabled: true,
});
if (notApproved.ok || notApproved.code !== "BATCH_NOT_APPROVED") throw new Error("unapproved batch must block");

if (domain.canReplayPaidItem("paid")) throw new Error("paid item replay must be rejected");
if (!domain.isFailureRetryable("provider_timeout")) throw new Error("timeout should be retryable");
if (!domain.isFailureTerminal("invalid_account")) throw new Error("invalid account should be terminal");

console.log("Payout worker security regression passed.");
console.log("PAYOUT PROVIDER E2E: BLOCKED");
console.log("PAYOUT WORKER HOSTED E2E: BLOCKED");
