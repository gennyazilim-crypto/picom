const SENSITIVE_KEY_PATTERN = /(password|passcode|token|cookie|authorization|secret|session|jwt|api[-_]?key|service[-_]?role|livekit|supabase|signing|private[-_]?key|access[-_]?token|refresh[-_]?token)/i;
const BEARER_PATTERN = /Bearer\s+[^\s,;"']+/gi;
const BASIC_AUTH_PATTERN = /Basic\s+[^\s,;"']+/gi;
const JWT_PATTERN = /\b[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\b/g;
const INLINE_SECRET_PATTERN = /(["']?(?:password|passcode|token|secret|authorization|cookie|session|jwt|api[-_]?key|apikey|(?:supabase[-_]?)?service[-_]?role(?:[-_]?key)?|livekit[-_]?(?:secret|api[-_]?secret)|signing[-_]?key|private[-_]?key|access[-_]?token|refresh[-_]?token)["']?\s*[:=]\s*)(["'][^"']*["']|[^&\s,}]+)/gi;
const BOT_TOKEN_PATTERN = /\bpicom_bot_[a-zA-Z0-9_-]{6,}_[a-zA-Z0-9_-]{20,}\b/g;
const PRIVATE_CONTENT_KEY_PATTERN = /^(body|content|preview|messageBody|messageText|rawMessage|attachmentUrl|signedUrl)$/i;

export function redactLogString(value: string): string {
  const redacted = value
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(BASIC_AUTH_PATTERN, "Basic [redacted]")
    .replace(JWT_PATTERN, "[redacted-jwt]")
    .replace(BOT_TOKEN_PATTERN, "[redacted-bot-token]")
    .replace(INLINE_SECRET_PATTERN, "$1[redacted]");

  return redacted.length > 1200 ? `${redacted.slice(0, 1200)}...[truncated]` : redacted;
}

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: redactLogString(value.name),
      message: redactLogString(value.message),
      stack: value.stack ? redactLogString(value.stack) : undefined,
    };
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    if (Array.isArray(value)) return value.map((item) => redactLogValue(item, seen));

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactLogValue(nestedValue, seen),
      ]),
    );
  }

  return typeof value === "string" ? redactLogString(value) : value;
}

function redactPrivateContentValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => redactPrivateContentValue(item, seen));
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      PRIVATE_CONTENT_KEY_PATTERN.test(key) ? "[redacted-private-content]" : redactPrivateContentValue(nestedValue, seen),
    ]));
  }
  return value;
}

export function redactDiagnosticValue(value: unknown): unknown {
  return redactPrivateContentValue(redactLogValue(value));
}
