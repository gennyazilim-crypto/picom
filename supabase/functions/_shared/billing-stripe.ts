export type BillingProviderName = "stripe";

export type StripeConfig = Readonly<{
  secretKey: string;
  webhookSecret: string;
  identityWebhookSecret: string | null;
  monthlyPriceId: string;
  yearlyPriceId: string;
}>;

export function readStripeConfig(): StripeConfig | null {
  const provider = (Deno.env.get("BILLING_PROVIDER")?.trim() || "stripe").toLowerCase();
  if (provider !== "stripe") return null;
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
  const monthlyPriceId = Deno.env.get("STRIPE_PICOM_VERIFIED_MONTHLY_PRICE_ID")?.trim() ?? "";
  const yearlyPriceId = Deno.env.get("STRIPE_PICOM_VERIFIED_YEARLY_PRICE_ID")?.trim() ?? "";
  if (!secretKey || !webhookSecret || !monthlyPriceId || !yearlyPriceId) return null;
  return {
    secretKey,
    webhookSecret,
    identityWebhookSecret: Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET")?.trim() || null,
    monthlyPriceId,
    yearlyPriceId,
  };
}

export function priceIdForPlan(config: StripeConfig, planKey: "picom_verified_monthly" | "picom_verified_yearly"): string {
  return planKey === "picom_verified_yearly" ? config.yearlyPriceId : config.monthlyPriceId;
}

export async function stripeRequest(
  config: StripeConfig,
  method: string,
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; code: string; message: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.secretKey}`,
  };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    method,
    headers,
    body: body?.toString(),
  });

  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = (json.error as { code?: string; message?: string } | undefined) ?? {};
    return {
      ok: false,
      status: response.status,
      code: error.code ?? "STRIPE_ERROR",
      message: "Stripe request failed.",
    };
  }
  return { ok: true, data: json };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<{ ok: true; timestamp: number } | { ok: false; reason: string }> {
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim() ?? "", value?.trim() ?? ""];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return { ok: false, reason: "invalid_signature_header" };
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) return { ok: false, reason: "timestamp_out_of_tolerance" };

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const digest = Array.from(new Uint8Array(mac)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (!timingSafeEqual(digest, signature)) return { ok: false, reason: "signature_mismatch" };
  return { ok: true, timestamp };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
