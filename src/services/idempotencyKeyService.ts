export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

export type IdempotencyOperation =
  | "send_message"
  | "create_community"
  | "create_channel"
  | "upload_attachment"
  | "accept_invite"
  | "create_invite"
  | "create_webhook";

export type IdempotencyValidationResult =
  | Readonly<{ ok: true; key: string }>
  | Readonly<{ ok: false; reason: "missing" | "too_short" | "too_long" | "unsafe_characters" }>;

export type RetrySafetyInput = Readonly<{
  method: string;
  idempotencyKey?: string | null;
}>;

const MIN_KEY_LENGTH = 12;
const MAX_KEY_LENGTH = 160;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const UNSAFE_METHODS_REQUIRING_IDEMPOTENCY_FOR_AUTO_RETRY = ["POST", "PATCH", "DELETE"] as const;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function createIdempotencyKey(operation: IdempotencyOperation, stablePart?: string | null): string {
  const safeOperation = normalizePart(operation);
  const safeSuffix = stablePart?.trim() ? normalizePart(stablePart) : randomId();
  const key = `picom:${safeOperation}:${safeSuffix}`;

  return key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
}

export function validateIdempotencyKey(idempotencyKey?: string | null): IdempotencyValidationResult {
  const key = idempotencyKey?.trim();

  if (!key) return { ok: false, reason: "missing" };
  if (key.length < MIN_KEY_LENGTH) return { ok: false, reason: "too_short" };
  if (key.length > MAX_KEY_LENGTH) return { ok: false, reason: "too_long" };
  if (!SAFE_KEY_PATTERN.test(key)) return { ok: false, reason: "unsafe_characters" };

  return { ok: true, key };
}

export function createIdempotencyHeaders(idempotencyKey?: string | null): Record<string, string> {
  const validation = validateIdempotencyKey(idempotencyKey);

  if (!validation.ok) return {};

  return {
    [IDEMPOTENCY_KEY_HEADER]: validation.key,
  };
}

export function canRetryRequestSafely(input: RetrySafetyInput): boolean {
  const method = input.method.trim().toUpperCase();

  if (SAFE_METHODS.has(method)) return true;

  return validateIdempotencyKey(input.idempotencyKey).ok;
}

export const idempotencyKeyService = {
  createKey: createIdempotencyKey,
  validateKey: validateIdempotencyKey,
  createHeaders: createIdempotencyHeaders,
  canRetryRequestSafely,
};
