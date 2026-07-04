type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: unknown;
};

const SENSITIVE_KEY_PATTERN = /(password|token|cookie|authorization|secret|session)/i;
const logs: LogEntry[] = [];
const MAX_LOGS = 100;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(nestedValue)
      ])
    );
  }

  if (typeof value === "string" && value.length > 1200) {
    return `${value.slice(0, 1200)}...[truncated]`;
  }

  return value;
}

function pushLog(level: LogLevel, message: string, metadata?: unknown): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata: metadata === undefined ? undefined : redactValue(metadata)
  };

  logs.push(entry);

  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

  return entry;
}

export const loggingService = {
  logInfo(message: string, metadata?: unknown): LogEntry {
    return pushLog("info", message, metadata);
  },

  logWarn(message: string, metadata?: unknown): LogEntry {
    return pushLog("warn", message, metadata);
  },

  logError(message: string, metadata?: unknown): LogEntry {
    return pushLog("error", message, metadata);
  },

  captureException(error: unknown, context?: unknown): LogEntry {
    const normalizedError = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };

    return pushLog("error", "Unhandled renderer exception", {
      error: normalizedError,
      context
    });
  },

  getLogs(): LogEntry[] {
    return [...logs];
  }
};