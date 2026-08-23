import { stripeRequest, verifyStripeWebhookSignature } from "./billing-stripe.ts";

export type PayoutProviderName = "stripe_connect";

export type PayoutProviderConfig = Readonly<{
  provider: PayoutProviderName;
  secretKey: string;
  webhookSecret: string;
  returnUrl: string;
  refreshUrl: string;
  defaultCurrency: string;
}>;

export function readPayoutProviderConfig(): PayoutProviderConfig | null {
  const provider = (Deno.env.get("PAYOUT_PROVIDER")?.trim() || "stripe_connect").toLowerCase();
  if (provider !== "stripe_connect" && provider !== "stripe") return null;
  const secretKey = (Deno.env.get("PAYOUT_PROVIDER_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  const webhookSecret = (Deno.env.get("PAYOUT_PROVIDER_WEBHOOK_SECRET") ?? "").trim();
  const returnUrl = (Deno.env.get("PAYOUT_ONBOARDING_RETURN_URL") ?? "").trim();
  const refreshUrl = (Deno.env.get("PAYOUT_ONBOARDING_REFRESH_URL") ?? "").trim();
  const defaultCurrency = (Deno.env.get("PAYOUT_DEFAULT_CURRENCY") ?? "USD").trim().toUpperCase();
  if (!secretKey || !webhookSecret || !returnUrl || !refreshUrl) return null;
  return {
    provider: "stripe_connect",
    secretKey,
    webhookSecret,
    returnUrl,
    refreshUrl,
    defaultCurrency,
  };
}

type StripeLikeConfig = Readonly<{ secretKey: string; webhookSecret: string; identityWebhookSecret: null; monthlyPriceId: string; yearlyPriceId: string }>;

function asStripeConfig(config: PayoutProviderConfig): StripeLikeConfig {
  return {
    secretKey: config.secretKey,
    webhookSecret: config.webhookSecret,
    identityWebhookSecret: null,
    monthlyPriceId: "unused",
    yearlyPriceId: "unused",
  };
}

export async function createConnectedAccount(
  config: PayoutProviderConfig,
  input: Readonly<{ country: string; currency: string; email?: string; idempotencyKey: string }>,
): Promise<{ ok: true; accountId: string } | { ok: false; code: string; message: string }> {
  const body = new URLSearchParams();
  body.set("type", "express");
  body.set("country", input.country.toUpperCase());
  body.set("default_currency", input.currency.toLowerCase());
  body.set("capabilities[transfers][requested]", "true");
  if (input.email) body.set("email", input.email);
  const result = await stripeRequest(asStripeConfig(config), "POST", "accounts", body, input.idempotencyKey);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider account create failed." };
  const id = typeof result.data.id === "string" ? result.data.id : null;
  if (!id) return { ok: false, code: "PROVIDER_ACCOUNT_MISSING", message: "Provider did not return account id." };
  return { ok: true, accountId: id };
}

export async function createAccountOnboardingLink(
  config: PayoutProviderConfig,
  accountId: string,
): Promise<{ ok: true; url: string } | { ok: false; code: string; message: string }> {
  const body = new URLSearchParams();
  body.set("account", accountId);
  body.set("refresh_url", config.refreshUrl);
  body.set("return_url", config.returnUrl);
  body.set("type", "account_onboarding");
  const result = await stripeRequest(asStripeConfig(config), "POST", "account_links", body);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider onboarding link failed." };
  const url = typeof result.data.url === "string" ? result.data.url : null;
  if (!url) return { ok: false, code: "PROVIDER_LINK_MISSING", message: "Provider did not return onboarding URL." };
  return { ok: true, url };
}

export async function createAccountUpdateLink(
  config: PayoutProviderConfig,
  accountId: string,
): Promise<{ ok: true; url: string } | { ok: false; code: string; message: string }> {
  const body = new URLSearchParams();
  body.set("account", accountId);
  body.set("refresh_url", config.refreshUrl);
  body.set("return_url", config.returnUrl);
  body.set("type", "account_update");
  const result = await stripeRequest(asStripeConfig(config), "POST", "account_links", body);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider update link failed." };
  const url = typeof result.data.url === "string" ? result.data.url : null;
  if (!url) return { ok: false, code: "PROVIDER_LINK_MISSING", message: "Provider did not return update URL." };
  return { ok: true, url };
}

export async function retrieveAccount(
  config: PayoutProviderConfig,
  accountId: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  const result = await stripeRequest(asStripeConfig(config), "GET", `accounts/${accountId}`);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider account retrieve failed." };
  return { ok: true, data: result.data };
}

export function normalizeAccountState(account: Record<string, unknown>): Readonly<{
  onboarding_status: string;
  capabilities_status: string;
  payout_status: string;
  requirements_status: string;
}> {
  const requirements = (account.requirements as { currently_due?: unknown[]; past_due?: unknown[]; disabled_reason?: string } | undefined) ?? {};
  const due = Array.isArray(requirements.currently_due) ? requirements.currently_due.length : 0;
  const pastDue = Array.isArray(requirements.past_due) ? requirements.past_due.length : 0;
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;

  let onboarding_status = "pending";
  if (pastDue > 0 || due > 0) onboarding_status = "requires_information";
  else if (detailsSubmitted) onboarding_status = "complete";

  let capabilities_status = "pending";
  if (chargesEnabled && payoutsEnabled) capabilities_status = "active";
  else if (requirements.disabled_reason) capabilities_status = "disabled";
  else if (due > 0) capabilities_status = "restricted";

  const payout_status = payoutsEnabled ? "enabled" : (capabilities_status === "disabled" ? "blocked" : "pending");
  const requirements_status = pastDue > 0 || due > 0 ? "requires_information" : "satisfied";

  return { onboarding_status, capabilities_status, payout_status, requirements_status };
}

export async function createTransferOrPayout(
  config: PayoutProviderConfig,
  input: Readonly<{
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    transferGroup?: string;
  }>,
): Promise<{ ok: true; transferId: string } | { ok: false; code: string; message: string }> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "AMOUNT_INVALID", message: "Transfer amount must be a positive integer minor unit." };
  }
  const body = new URLSearchParams();
  body.set("amount", String(input.amountMinor));
  body.set("currency", input.currency.toLowerCase());
  body.set("destination", input.destinationAccountId);
  if (input.transferGroup) body.set("transfer_group", input.transferGroup);
  const result = await stripeRequest(asStripeConfig(config), "POST", "transfers", body, input.idempotencyKey);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider transfer failed." };
  const id = typeof result.data.id === "string" ? result.data.id : null;
  if (!id) return { ok: false, code: "PROVIDER_TRANSFER_MISSING", message: "Provider did not return transfer id." };
  return { ok: true, transferId: id };
}

export async function retrieveTransferOrPayout(
  config: PayoutProviderConfig,
  transferId: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  const result = await stripeRequest(asStripeConfig(config), "GET", `transfers/${transferId}`);
  if (!result.ok) return { ok: false, code: result.code, message: "Provider transfer retrieve failed." };
  return { ok: true, data: result.data };
}

export async function verifyPayoutWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<{ ok: true; timestamp: number } | { ok: false; reason: string }> {
  return verifyStripeWebhookSignature(rawBody, signatureHeader, secret);
}

export function normalizeProviderError(code: string): Readonly<{ class: "retryable" | "terminal" | "unknown"; safe_code: string }> {
  const retryable = new Set(["provider_timeout", "temporary_provider_error", "rate_limit", "transient_bank_unavailable", "lock_timeout"]);
  const terminal = new Set([
    "invalid_account", "account_closed", "beneficiary_mismatch", "compliance_block", "tax_block",
    "unsupported_currency", "provider_account_disabled", "suspected_fraud",
  ]);
  if (retryable.has(code)) return { class: "retryable", safe_code: code };
  if (terminal.has(code)) return { class: "terminal", safe_code: code };
  return { class: "unknown", safe_code: "provider_error" };
}

export const PAYOUT_WEBHOOK_EVENT_TYPES = [
  "account.updated",
  "account.requirements_changed",
  "transfer.created",
  "transfer.paid",
  "transfer.failed",
  "transfer.reversed",
  "payout.created",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "external_account.updated",
  "capability.updated",
] as const;
