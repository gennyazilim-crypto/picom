/** Server-side advertising domain helpers used by regressions and Edge signing. */

export const ALLOWED_TARGETING_KEYS = [
  "country",
  "region",
  "language",
  "platform",
  "operating_system",
  "placement",
  "content_category",
  "community_category",
  "event_category",
  "age_eligibility",
  "contextual_interest",
  "followed_business",
  "device_class",
  "daypart",
] as const;

export const SENSITIVE_TARGETING_KEYS = [
  "race",
  "ethnicity",
  "religion",
  "sexual_orientation",
  "health_condition",
  "political_belief",
  "union_membership",
  "precise_geolocation",
  "private_message_content",
  "contact_list",
  "voice_conversation",
  "private_files",
  "account_password",
  "child_behavioural_profile",
  "financial_hardship",
  "criminal_allegation",
  "biometric_data",
  "retargeting",
] as const;

export const DISABLED_OBJECTIVES = ["sales", "purchase_optimization", "roas_optimization", "auction"] as const;

export const CAMPAIGN_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["in_review", "requires_changes", "rejected", "approved"],
  in_review: ["requires_changes", "rejected", "approved"],
  requires_changes: ["submitted", "cancelled"],
  approved: ["scheduled", "active", "cancelled"],
  scheduled: ["active", "paused", "cancelled"],
  active: ["paused", "budget_exhausted", "completed", "suspended"],
  paused: ["active", "cancelled", "completed"],
  budget_exhausted: ["completed", "cancelled"],
  rejected: [],
  suspended: [],
  completed: [],
  cancelled: [],
  archived: [],
};

export function validateTargetingSpec(spec: Record<string, unknown>): { ok: true } | { ok: false; code: string } {
  for (const key of Object.keys(spec)) {
    if ((SENSITIVE_TARGETING_KEYS as readonly string[]).includes(key)) {
      return { ok: false, code: "AD_TARGETING_SENSITIVE_REJECTED" };
    }
    if (!(ALLOWED_TARGETING_KEYS as readonly string[]).includes(key)) {
      return { ok: false, code: "AD_TARGETING_UNKNOWN_KEY" };
    }
  }
  return { ok: true };
}

export function canTransitionCampaign(from: string, to: string): boolean {
  return (CAMPAIGN_TRANSITIONS[from] ?? []).includes(to);
}

export function isImpressionBillable(visibilityRatio: number, visibleDurationMs: number, opts?: {
  minRatio?: number;
  minMs?: number;
}): boolean {
  const minRatio = opts?.minRatio ?? 0.5;
  const minMs = opts?.minMs ?? 1000;
  return visibilityRatio >= minRatio && visibleDurationMs >= minMs;
}

export function computePartnerShares(
  eligibleMinor: number,
  platformPercentage: number,
  partnerPercentage: number,
): { platformShareMinor: number; partnerShareMinor: number } {
  if (platformPercentage + partnerPercentage !== 100) {
    throw new Error("CONTRACT_SHARE_INVALID");
  }
  if (!Number.isInteger(eligibleMinor) || eligibleMinor < 0) {
    throw new Error("ELIGIBLE_AMOUNT_INVALID");
  }
  const platformShareMinor = Math.floor((eligibleMinor * platformPercentage) / 100);
  const partnerShareMinor = eligibleMinor - platformShareMinor;
  return { platformShareMinor, partnerShareMinor };
}

export function reservationRemaining(amountMinor: number, consumedAmountMinor: number): number {
  if (consumedAmountMinor > amountMinor) throw new Error("RESERVATION_OVER_CONSUMED");
  return amountMinor - consumedAmountMinor;
}

export function applySpendToReservation(
  amountMinor: number,
  consumedAmountMinor: number,
  chargeMinor: number,
): { consumed: number; exhausted: boolean } {
  if (chargeMinor <= 0) throw new Error("SPEND_AMOUNT_INVALID");
  const remaining = reservationRemaining(amountMinor, consumedAmountMinor);
  if (chargeMinor > remaining) throw new Error("BUDGET_EXHAUSTED");
  const consumed = consumedAmountMinor + chargeMinor;
  return { consumed, exhausted: consumed >= amountMinor };
}

export function publicExplanationReasons(factors: readonly string[]): readonly string[] {
  const reasons = ["This is sponsored content."];
  if (factors.includes("country")) reasons.push("This ad is shown to people in your country.");
  if (factors.includes("language")) reasons.push("This ad is shown based on your app language.");
  if (factors.includes("content_category")) reasons.push("This ad is related to the content category you are viewing.");
  if (factors.includes("community_category")) reasons.push("This ad is related to this community category.");
  if (factors.includes("event_category")) reasons.push("This ad is shown in this event category.");
  reasons.push("PICOM does not use sensitive attributes such as race, religion, health, or political belief for targeting.");
  return reasons;
}

export function assertNoSensitiveExplanationLeak(payload: Record<string, unknown>): void {
  const banned = ["bid", "fraud", "pricing", "billable_rate", "targeting_spec", "user_binding", "segment_id"];
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const key of banned) {
    if (serialized.includes(key)) throw new Error(`SENSITIVE_EXPLANATION_LEAK:${key}`);
  }
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function signDeliveryToken(
  secret: string,
  claims: Record<string, string | number | boolean>,
): Promise<string> {
  if (!secret) throw new Error("AD_DELIVERY_SIGNING_SECRET_MISSING");
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifyDeliveryToken(
  secret: string,
  token: string,
): Promise<Record<string, unknown>> {
  if (!secret) throw new Error("AD_DELIVERY_SIGNING_SECRET_MISSING");
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("DELIVERY_TOKEN_INVALID");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = Uint8Array.from(fromBase64Url(sig));
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(payload),
  );
  if (!ok) throw new Error("DELIVERY_TOKEN_SIGNATURE_INVALID");
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Record<string, unknown>;
  const expiresAt = typeof claims.expires_at === "number" ? claims.expires_at : 0;
  if (expiresAt < Math.floor(Date.now() / 1000)) throw new Error("DELIVERY_TOKEN_EXPIRED");
  return claims;
}

export function isSafeHttpsDestination(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (["javascript:", "data:", "file:"].includes(parsed.protocol)) return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
