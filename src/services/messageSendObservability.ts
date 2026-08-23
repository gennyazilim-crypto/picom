export type MessageSendOperation = "community_message" | "direct_message";

export type MessageSendErrorCategory =
  | "auth"
  | "permission"
  | "validation"
  | "rate_limit"
  | "conflict"
  | "network"
  | "timeout"
  | "server"
  | "unknown";

export type MessageSendError = Readonly<{
  category: MessageSendErrorCategory;
  code: string;
  postgresCode?: string;
  httpStatus?: number;
  retryable: boolean;
  userMessage: string;
  message: string;
  correlationId: string;
  operation: MessageSendOperation;
  details?: string;
  hint?: string;
  retryAfterMs?: number;
}>;

export type MessageSendAttemptState = Readonly<{
  correlationId: string;
  attemptCount: number;
  retryable: boolean;
  lastErrorCode?: string;
  serverMessageId?: string;
}>;

export type MessageSendContext = Readonly<{
  operation: MessageSendOperation;
  correlationId: string;
  actorId?: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  clientMessageId?: string;
}>;

type SafeErrorDetails = Readonly<{
  name?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  httpStatus?: number;
  retryAfterMs?: number;
}>;

type MessageSessionClient = Readonly<{
  auth: {
    refreshSession: () => Promise<{
      data: { session: { access_token: string } | null };
      error: unknown;
    }>;
  };
  realtime: {
    setAuth: (token: string) => void | Promise<void>;
  };
}>;

type MessageMutationResult<T> = Readonly<{
  data: T | null;
  error: unknown;
}>;

export type MessageSendAttemptEvent = Readonly<{
  attemptNumber: number;
  outcome: "success" | "failure";
  durationMs: number;
  sessionRefreshAttempted: boolean;
  error?: MessageSendError;
}>;

type ExecuteMessageSendOptions<T> = Readonly<{
  client: MessageSessionClient;
  context: MessageSendContext;
  operation: () => Promise<MessageMutationResult<T>>;
  onAttempt?: (event: MessageSendAttemptEvent) => void;
  delay?: (milliseconds: number) => Promise<void>;
}>;

export type MessageSendExecution<T> = Readonly<{
  result: MessageMutationResult<T>;
  attemptCount: number;
  sessionRefreshAttempted: boolean;
  error?: MessageSendError;
}>;

let fallbackCorrelationCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanDiagnosticText(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, 320) || undefined;
}

function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.min(value > 1_000 ? value : value * 1_000, 30_000);
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.min(Math.max(0, timestamp - Date.now()), 30_000);
}

function extractSafeErrorDetails(error: unknown): SafeErrorDetails {
  const fromError = error instanceof Error
    ? { name: error.name, message: error.message }
    : {};
  if (!isRecord(error)) return fromError;

  const context = isRecord(error.context) ? error.context : undefined;
  const status = readNumber(error, "status")
    ?? readNumber(error, "statusCode")
    ?? (context ? readNumber(context, "status") : undefined);

  return {
    name: fromError.name ?? readString(error, "name"),
    message: cleanDiagnosticText(fromError.message ?? readString(error, "message")),
    code: readString(error, "code"),
    details: cleanDiagnosticText(readString(error, "details")),
    hint: cleanDiagnosticText(readString(error, "hint")),
    httpStatus: status,
    retryAfterMs: parseRetryAfter(error.retryAfter ?? error.retry_after),
  };
}

function containsAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function extractStableDatabaseCode(details: SafeErrorDetails): string | undefined {
  const text = `${details.message ?? ""} ${details.details ?? ""} ${details.hint ?? ""}`;
  return text.match(/\b(?:MESSAGE|DM)_[A-Z0-9_]+\b/)?.[0];
}

function categoryFrom(details: SafeErrorDetails): MessageSendErrorCategory {
  const normalized = `${details.name ?? ""} ${details.message ?? ""} ${details.code ?? ""} ${details.details ?? ""}`.toLowerCase();
  const status = details.httpStatus;
  const databaseCode = details.code?.toUpperCase();

  if (
    status === 401
    || databaseCode === "PGRST301"
    || containsAny(normalized, ["jwt expired", "invalid jwt", "auth session missing", "not authenticated", "authentication required"])
  ) return "auth";
  if (
    status === 403
    || databaseCode === "42501"
    || containsAny(normalized, ["message_send_forbidden", "dm_send_forbidden", "permission denied", "row-level security", "not allowed"])
  ) return "permission";
  if (status === 429 || containsAny(normalized, ["rate limit", "too many requests", "rate_limited"])) return "rate_limit";
  if (status === 409 || databaseCode === "23505" || containsAny(normalized, ["idempot", "duplicate key", "conflict"])) return "conflict";
  if (details.name === "AbortError" || databaseCode === "57014" || containsAny(normalized, ["timeout", "timed out", "query canceled"])) return "timeout";
  if (containsAny(normalized, ["failed to fetch", "networkerror", "network request failed", "load failed", "offline"])) return "network";
  if (
    status === 400
    || status === 422
    || Boolean(databaseCode && ["22001", "22P02", "23502", "23503", "23514", "PGRST102"].includes(databaseCode))
    || containsAny(normalized, ["validation", "invalid input", "foreign key", "not-null"])
  ) return "validation";
  if (typeof status === "number" && status >= 500) return "server";
  return "unknown";
}

function stableCode(category: MessageSendErrorCategory, details: SafeErrorDetails): string {
  const databaseCode = extractStableDatabaseCode(details);
  if (databaseCode) return databaseCode;
  const mapped: Record<MessageSendErrorCategory, string> = {
    auth: "MESSAGE_SEND_AUTH",
    permission: "MESSAGE_SEND_FORBIDDEN",
    validation: "MESSAGE_SEND_VALIDATION",
    rate_limit: "MESSAGE_SEND_RATE_LIMITED",
    conflict: "MESSAGE_SEND_CONFLICT",
    network: "MESSAGE_SEND_NETWORK",
    timeout: "MESSAGE_SEND_TIMEOUT",
    server: "MESSAGE_SEND_SERVER",
    unknown: "MESSAGE_SEND_UNKNOWN",
  };
  return mapped[category];
}

function categoryUserMessage(category: MessageSendErrorCategory): string {
  const messages: Record<MessageSendErrorCategory, string> = {
    auth: "Your session could not be refreshed. Sign in again before retrying.",
    permission: "You do not have permission to send this message.",
    validation: "The message or its destination is not valid.",
    rate_limit: "Too many messages were sent. Wait a moment and retry.",
    conflict: "Picom found an existing send with this message reference and is reconciling it.",
    network: "Picom could not reach the message service. Check your connection and retry.",
    timeout: "The message service took too long to respond. Retry when the connection is stable.",
    server: "The message service is temporarily unavailable. Retry in a moment.",
    unknown: "The message was not sent.",
  };
  return messages[category];
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function isAutomaticTransientRetry(error: MessageSendError): boolean {
  return error.category === "rate_limit"
    || error.category === "network"
    || error.category === "timeout"
    || error.category === "server";
}

function nowMilliseconds(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function createMessageSendCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  fallbackCorrelationCounter += 1;
  return `msg-${Date.now().toString(36)}-${fallbackCorrelationCounter.toString(36)}`;
}

export function getMessageSendReference(correlationId?: string): string {
  if (!correlationId) return "UNKNOWN";
  return correlationId.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase() || "UNKNOWN";
}

export function maskMessageSendIdentifier(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  return `***${value.trim().slice(-8)}`;
}

export function classifyMessageSendError(error: unknown, context: MessageSendContext): MessageSendError {
  const details = extractSafeErrorDetails(error);
  const category = categoryFrom(details);
  const userMessage = categoryUserMessage(category);
  return {
    category,
    code: stableCode(category, details),
    postgresCode: details.code,
    httpStatus: details.httpStatus,
    retryable: category === "rate_limit" || category === "network" || category === "timeout" || category === "server",
    userMessage,
    message: userMessage,
    correlationId: context.correlationId,
    operation: context.operation,
    details: details.details,
    hint: details.hint,
    retryAfterMs: details.retryAfterMs,
  };
}

export function isMessageSendError(error: unknown): error is MessageSendError {
  if (!isRecord(error)) return false;
  return typeof error.category === "string"
    && typeof error.code === "string"
    && typeof error.retryable === "boolean"
    && typeof error.userMessage === "string"
    && typeof error.message === "string"
    && typeof error.correlationId === "string"
    && (error.operation === "community_message" || error.operation === "direct_message");
}

export function toMessageSendLogMetadata(
  context: MessageSendContext,
  event: MessageSendAttemptEvent,
): Record<string, unknown> {
  return {
    operation: context.operation,
    correlation_id: context.correlationId,
    actor_id: maskMessageSendIdentifier(context.actorId),
    community_id: context.communityId,
    channel_id: context.channelId,
    conversation_id: context.conversationId,
    client_message_id: maskMessageSendIdentifier(context.clientMessageId),
    attempt_count: event.attemptNumber,
    session_refresh_attempted: event.sessionRefreshAttempted,
    outcome: event.outcome,
    duration_ms: Math.max(0, Math.round(event.durationMs)),
    error_category: event.error?.category,
    error_code: event.error?.code,
    postgres_code: event.error?.postgresCode,
    http_status: event.error?.httpStatus,
    retryable: event.error?.retryable,
    build_id: import.meta.env.VITE_BUILD_COMMIT ?? "local",
  };
}

export async function executeMessageSendWithRetry<T>({
  client,
  context,
  operation,
  onAttempt,
  delay = defaultDelay,
}: ExecuteMessageSendOptions<T>): Promise<MessageSendExecution<T>> {
  let attemptCount = 0;
  let sessionRefreshAttempted = false;
  let transientRetryAttempted = false;

  while (attemptCount < 3) {
    attemptCount += 1;
    const startedAt = nowMilliseconds();
    let result: MessageMutationResult<T>;
    try {
      result = await operation();
    } catch (error) {
      result = { data: null, error };
    }

    const durationMs = nowMilliseconds() - startedAt;
    if (!result.error) {
      onAttempt?.({ attemptNumber: attemptCount, outcome: "success", durationMs, sessionRefreshAttempted });
      return { result, attemptCount, sessionRefreshAttempted };
    }

    let classified = classifyMessageSendError(result.error, context);
    onAttempt?.({ attemptNumber: attemptCount, outcome: "failure", durationMs, sessionRefreshAttempted, error: classified });

    if (classified.category === "auth" && !sessionRefreshAttempted) {
      sessionRefreshAttempted = true;
      const refresh = await client.auth.refreshSession();
      const accessToken = refresh.data.session?.access_token;
      if (!refresh.error && accessToken) {
        await client.realtime.setAuth(accessToken);
        continue;
      }
      classified = { ...classified, retryable: false };
      return { result, attemptCount, sessionRefreshAttempted, error: classified };
    }

    if (isAutomaticTransientRetry(classified) && !transientRetryAttempted) {
      transientRetryAttempted = true;
      await delay(classified.retryAfterMs ?? (classified.category === "server" ? 700 : 350));
      continue;
    }

    return { result, attemptCount, sessionRefreshAttempted, error: classified };
  }

  const exhausted = classifyMessageSendError(new Error("Message send retry budget exhausted."), context);
  return {
    result: { data: null, error: exhausted },
    attemptCount,
    sessionRefreshAttempted,
    error: exhausted,
  };
}
