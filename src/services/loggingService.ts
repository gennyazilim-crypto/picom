export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: unknown;
};

type LogListener = (entry: LogEntry) => void;

const SENSITIVE_KEY_PATTERN = /(password|passcode|token|cookie|authorization|secret|session|jwt|api[-_]?key|service[-_]?role)/i;
const BEARER_PATTERN = /Bearer\s+[a-zA-Z0-9._-]+/g;
const JWT_PATTERN = /\b[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\b/g;
const KEY_VALUE_SECRET_PATTERN = /\b(password|token|secret|authorization|cookie|api_key|apikey|session)=([^&\s]+)/gi;
const logs: LogEntry[] = [];
const listeners = new Set<LogListener>();
const MAX_LOGS = 250;
let logCounter = 0;

function redactString(value: string): string {
  const redacted = value
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(JWT_PATTERN, "[redacted-jwt]")
    .replace(KEY_VALUE_SECRET_PATTERN, "$1=[redacted]");

  return redacted.length > 1200 ? `${redacted.slice(0, 1200)}...[truncated]` : redacted;
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (value instanceof Error) {
    return {
      name: redactString(value.name),
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined
    };
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(nestedValue, seen)
      ])
    );
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  return value;
}

function pushLog(level: LogLevel, message: string, metadata?: unknown, source?: string): LogEntry {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${logCounter++}`,
    timestamp: new Date().toISOString(),
    level,
    message: redactString(message),
    source,
    metadata: metadata === undefined ? undefined : redactValue(metadata)
  };

  logs.push(entry);

  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

  for (const listener of listeners) {
    listener(entry);
  }

  return entry;
}

export const loggingService = {
  log(level: LogLevel, message: string, metadata?: unknown, source?: string): LogEntry {
    return pushLog(level, message, metadata, source);
  },

  logDebug(message: string, metadata?: unknown, source?: string): LogEntry {
    return pushLog("debug", message, metadata, source);
  },

  logInfo(message: string, metadata?: unknown, source?: string): LogEntry {
    return pushLog("info", message, metadata, source);
  },

  logWarn(message: string, metadata?: unknown, source?: string): LogEntry {
    return pushLog("warn", message, metadata, source);
  },

  logError(message: string, metadata?: unknown, source?: string): LogEntry {
    return pushLog("error", message, metadata, source);
  },

  captureException(error: unknown, context?: unknown): LogEntry {
    const normalizedError = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };

    return pushLog("error", "Unhandled renderer exception", {
      error: normalizedError,
      context
    }, "renderer");
  },

  getLogs(): LogEntry[] {
    return [...logs];
  },

  getRecentLogs(limit = MAX_LOGS): LogEntry[] {
    return logs.slice(Math.max(0, logs.length - limit));
  },

  clearLogs(): void {
    logs.length = 0;
  },

  exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  },

  onLog(listener: LogListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  formatUserError(_error: unknown, fallbackMessage = "Something went wrong. Please try again."): string {
    return fallbackMessage;
  }
};
