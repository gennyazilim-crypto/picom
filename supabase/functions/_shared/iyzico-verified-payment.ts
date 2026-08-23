import {
  retrieveIyzicoPayment,
  type IyzicoConfig,
  validateIyzicoPaymentDetail,
} from "./iyzico.ts";

type AdminClient = {
  from(table: string): any;
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

type PaymentIntentRow = Readonly<{
  id: string;
  user_id: string;
  status: string;
  conversation_id: string;
  expected_amount_minor: number;
  currency: string;
  expires_at: string;
}>;

export type VerifiedPaymentReconciliation = Readonly<{
  outcome: "activated" | "already_activated" | "pending" | "failed" | "expired" | "unavailable";
  intentId: string;
  failureCode?: string;
}>;

async function appendAudit(
  admin: AdminClient,
  intentId: string,
  eventType: string,
  source: "server" | "webhook" | "reconciliation" | "expiry",
  safeMetadata: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("verified_payment_audit_events").insert({
    payment_intent_id: intentId,
    event_type: eventType,
    source,
    safe_metadata: safeMetadata,
  });
}

async function setIntentState(
  admin: AdminClient,
  intentId: string,
  status: "verification_pending" | "failed" | "expired",
  failureCode: string,
  source: "server" | "webhook" | "reconciliation" | "expiry",
): Promise<void> {
  await admin.from("verified_payment_intents")
    .update({ status, failure_code: failureCode })
    .eq("id", intentId)
    .neq("status", "paid");
  await appendAudit(admin, intentId, `payment_${status}`, source, { failureCode });
}

function asIntent(value: unknown): PaymentIntentRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.user_id === "string"
    && typeof row.status === "string"
    && typeof row.conversation_id === "string"
    && typeof row.expected_amount_minor === "number"
    && typeof row.currency === "string"
    && typeof row.expires_at === "string"
    ? row as PaymentIntentRow
    : null;
}

export async function reconcileIyzicoVerifiedPayment(
  admin: AdminClient,
  config: IyzicoConfig,
  intentId: string,
  source: "server" | "webhook" | "reconciliation" = "reconciliation",
): Promise<VerifiedPaymentReconciliation> {
  const intentResult = await admin.from("verified_payment_intents")
    .select("id,user_id,status,conversation_id,expected_amount_minor,currency,expires_at")
    .eq("id", intentId)
    .eq("provider", "iyzico")
    .maybeSingle();
  const intent = asIntent(intentResult.data);
  if (!intent) return { outcome: "failed", intentId, failureCode: "PAYMENT_INTENT_NOT_FOUND" };
  if (intent.status === "paid") return { outcome: "already_activated", intentId };
  if (["failed", "expired", "cancelled"].includes(intent.status)) return { outcome: intent.status === "expired" ? "expired" : "failed", intentId, failureCode: intent.status };

  if (Date.parse(intent.expires_at) <= Date.now()) {
    await setIntentState(admin, intent.id, "expired", "PAYMENT_INTENT_EXPIRED", "expiry");
    return { outcome: "expired", intentId: intent.id, failureCode: "PAYMENT_INTENT_EXPIRED" };
  }

  const retrieved = await retrieveIyzicoPayment(config, intent.conversation_id);
  if (!retrieved.ok) return { outcome: "unavailable", intentId: intent.id, failureCode: "PROVIDER_RETRIEVAL_UNAVAILABLE" };

  const validation = await validateIyzicoPaymentDetail(config, retrieved.data, {
    conversationId: intent.conversation_id,
    expectedAmountMinor: intent.expected_amount_minor,
    currency: intent.currency,
  });
  if (!validation.ok) {
    const status = validation.kind === "pending" ? "verification_pending" : "failed";
    await setIntentState(admin, intent.id, status, validation.failureCode, source);
    return { outcome: validation.kind === "pending" ? "pending" : "failed", intentId: intent.id, failureCode: validation.failureCode };
  }

  const activated = await admin.rpc("activate_iyzico_verified_payment", {
    target_intent_id: intent.id,
    target_provider_payment_id: validation.providerPaymentId,
    target_verified_at: new Date().toISOString(),
  });
  if (activated.error) {
    return { outcome: "unavailable", intentId: intent.id, failureCode: activated.error.code === "23505" ? "PROVIDER_PAYMENT_ALREADY_CONSUMED" : "ACTIVATION_UNAVAILABLE" };
  }

  const response = activated.data && typeof activated.data === "object" ? activated.data as Record<string, unknown> : {};
  return {
    outcome: response.idempotent === true ? "already_activated" : "activated",
    intentId: intent.id,
  };
}
