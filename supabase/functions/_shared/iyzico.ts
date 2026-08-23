export type IyzicoConfig = Readonly<{
  apiKey: string;
  secretKey: string;
  apiBaseUrl: string;
  linkProductImageBase64: string;
  intentTtlMinutes: number;
  webhookSignatureEnabled: boolean;
}>;

export type IyzicoPaymentDetail = Readonly<{
  status?: unknown;
  paymentStatus?: unknown;
  paymentId?: unknown;
  conversationId?: unknown;
  paymentConversationId?: unknown;
  price?: unknown;
  paidPrice?: unknown;
  currency?: unknown;
  fraudStatus?: unknown;
  basketId?: unknown;
  signature?: unknown;
  errorCode?: unknown;
}>;

const IYZICO_PRODUCTION_URL = "https://api.iyzipay.com";
const IYZICO_SANDBOX_URL = "https://sandbox-api.iyzipay.com";

function readNonEmptyEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function isConfiguredTtl(value: string | null): value is string {
  if (!value || !/^\d+$/.test(value)) return false;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 1_440;
}

export function readIyzicoConfig(): IyzicoConfig | null {
  const apiKey = readNonEmptyEnv("IYZICO_API_KEY");
  const secretKey = readNonEmptyEnv("IYZICO_SECRET_KEY");
  const apiBaseUrl = readNonEmptyEnv("IYZICO_API_BASE_URL");
  const linkProductImageBase64 = readNonEmptyEnv("IYZICO_LINK_PRODUCT_IMAGE_BASE64");
  const intentTtl = readNonEmptyEnv("IYZICO_VERIFIED_INTENT_TTL_MINUTES");
  const webhookSignatureEnabled = readNonEmptyEnv("IYZICO_WEBHOOK_SIGNATURE_ENABLED")?.toLowerCase() === "true";

  if (!apiKey || !secretKey || !apiBaseUrl || !linkProductImageBase64 || !isConfiguredTtl(intentTtl)) return null;
  if (apiBaseUrl !== IYZICO_PRODUCTION_URL && apiBaseUrl !== IYZICO_SANDBOX_URL) return null;

  return {
    apiKey,
    secretKey,
    apiBaseUrl,
    linkProductImageBase64,
    intentTtlMinutes: Number(intentTtl),
    webhookSignatureEnabled,
  };
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDecimal(value: unknown): string | null {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : asString(value);
  if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function minorToIyzicoAmount(amountMinor: number): string | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
  const whole = Math.floor(amountMinor / 100);
  const fraction = amountMinor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

export function iyzicoAmountMatchesMinor(value: unknown, expectedMinor: number): boolean {
  const normalized = normalizeDecimal(value);
  const expected = minorToIyzicoAmount(expectedMinor);
  return normalized !== null && expected !== null && normalized === expected;
}

export function isAllowedIyzicoPaymentUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return host === "iyzi.link" || host.endsWith(".iyzi.link") || host === "iyzilink.com" || host.endsWith(".iyzilink.com");
  } catch {
    return false;
  }
}

async function iyzicoAuthorization(config: IyzicoConfig, path: string, rawBody: string): Promise<Readonly<{ authorization: string; randomKey: string }>> {
  const randomKey = crypto.randomUUID().replace(/-/g, "");
  const signature = await hmacSha256Hex(config.secretKey, `${randomKey}${path}${rawBody}`);
  const authorizationValue = `apiKey:${config.apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    authorization: `IYZWSv2 ${btoa(authorizationValue)}`,
    randomKey,
  };
}

export async function iyzicoRequest(
  config: IyzicoConfig,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
): Promise<Readonly<{ ok: true; data: Record<string, unknown> }> | Readonly<{ ok: false; status: number }>> {
  const rawBody = body ? JSON.stringify(body) : "";
  const auth = await iyzicoAuthorization(config, path, rawBody);
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: auth.authorization,
        "x-iyzi-rnd": auth.randomKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: rawBody } : {}),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) return { ok: false, status: response.status };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function retrieveIyzicoPayment(
  config: IyzicoConfig,
  paymentConversationId: string,
): Promise<Readonly<{ ok: true; data: IyzicoPaymentDetail }> | Readonly<{ ok: false; status: number }>> {
  const response = await iyzicoRequest(config, "POST", "/payment/detail", {
    locale: "en",
    paymentConversationId,
    conversationId: `verify_${crypto.randomUUID()}`,
  });
  return response.ok ? { ok: true, data: response.data } : response;
}

export async function verifyIyzicoPaymentResponseSignature(config: IyzicoConfig, detail: IyzicoPaymentDetail): Promise<boolean> {
  const paymentId = asString(detail.paymentId);
  const currency = asString(detail.currency);
  const basketId = asString(detail.basketId);
  const conversationId = asString(detail.conversationId) ?? asString(detail.paymentConversationId);
  const paidPrice = normalizeDecimal(detail.paidPrice);
  const price = normalizeDecimal(detail.price);
  const signature = asString(detail.signature);
  if (!paymentId || !currency || !basketId || !conversationId || !paidPrice || !price || !signature) return false;
  const expected = await hmacSha256Hex(config.secretKey, [paymentId, currency, basketId, conversationId, paidPrice, price].join(":"));
  return timingSafeEqual(expected.toLowerCase(), signature.toLowerCase());
}

export async function verifyIyzicoWebhookSignature(config: IyzicoConfig, payload: Record<string, unknown>, signature: string | null): Promise<boolean> {
  const eventType = asString(payload.iyziEventType);
  const paymentId = asString(payload.paymentId) ?? asString(payload.iyziPaymentId);
  const conversationId = asString(payload.paymentConversationId) ?? asString(payload.conversationId);
  const status = asString(payload.status);
  if (!eventType || !paymentId || !conversationId || !status || !signature) return false;
  const expected = await hmacSha256Hex(config.secretKey, `${config.secretKey}${eventType}${paymentId}${conversationId}${status}`);
  return timingSafeEqual(expected.toLowerCase(), signature.trim().toLowerCase());
}

export type IyzicoPaymentValidation =
  | Readonly<{ ok: true; providerPaymentId: string }>
  | Readonly<{ ok: false; kind: "pending" | "failed"; failureCode: string }>;

export async function validateIyzicoPaymentDetail(
  config: IyzicoConfig,
  detail: IyzicoPaymentDetail,
  intent: Readonly<{ conversationId: string; expectedAmountMinor: number; currency: string }>,
): Promise<IyzicoPaymentValidation> {
  if (String(detail.status ?? "").toLowerCase() !== "success") {
    return { ok: false, kind: "pending", failureCode: "PAYMENT_NOT_FINAL" };
  }
  if (String(detail.paymentStatus ?? "").toUpperCase() !== "SUCCESS") {
    const paymentStatus = String(detail.paymentStatus ?? "").toUpperCase();
    return paymentStatus.includes("INIT") || paymentStatus.includes("PENDING")
      ? { ok: false, kind: "pending", failureCode: "PAYMENT_PENDING" }
      : { ok: false, kind: "failed", failureCode: "PAYMENT_UNSUCCESSFUL" };
  }
  if (Number(detail.fraudStatus) !== 1) {
    return Number(detail.fraudStatus) === 0
      ? { ok: false, kind: "pending", failureCode: "FRAUD_REVIEW_PENDING" }
      : { ok: false, kind: "failed", failureCode: "FRAUD_REJECTED" };
  }
  const paymentId = asString(detail.paymentId);
  const conversationId = asString(detail.conversationId) ?? asString(detail.paymentConversationId);
  if (!paymentId || conversationId !== intent.conversationId) return { ok: false, kind: "failed", failureCode: "CORRELATION_MISMATCH" };
  if (asString(detail.currency)?.toUpperCase() !== intent.currency.toUpperCase()) return { ok: false, kind: "failed", failureCode: "CURRENCY_MISMATCH" };
  if (!iyzicoAmountMatchesMinor(detail.price, intent.expectedAmountMinor) || !iyzicoAmountMatchesMinor(detail.paidPrice, intent.expectedAmountMinor)) {
    return { ok: false, kind: "failed", failureCode: "AMOUNT_MISMATCH" };
  }
  if (!await verifyIyzicoPaymentResponseSignature(config, detail)) return { ok: false, kind: "failed", failureCode: "RESPONSE_SIGNATURE_INVALID" };
  return { ok: true, providerPaymentId: paymentId };
}
