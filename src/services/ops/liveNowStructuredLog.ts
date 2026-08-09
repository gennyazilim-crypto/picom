import { loggingService } from "../loggingService";
import { createLiveNowCorrelationId, sanitizeCorrelationId, type LiveNowCorrelationScope } from "./liveNowCorrelation";
import type { LiveNowLogSeverity } from "./liveNowHealthModel";

export type LiveNowStructuredLogInput = Readonly<{
  service: string;
  severity: LiveNowLogSeverity;
  event: string;
  correlationId?: string | null;
  resourceId?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
  scope?: LiveNowCorrelationScope;
}>;

export type LiveNowStructuredLogRecord = Readonly<{
  timestamp: string;
  service: string;
  severity: LiveNowLogSeverity;
  event: string;
  correlation_id: string;
  resource_id: string | null;
  error_code: string | null;
}>;

function mapSeverityToLogLevel(severity: LiveNowLogSeverity): "debug" | "info" | "warn" | "error" {
  if (severity === "DEBUG") return "debug";
  if (severity === "INFO") return "info";
  if (severity === "WARN") return "warn";
  return "error";
}

/**
 * Emit a redacted structured ops log. Never pass JWTs, stream keys, or KYC payloads in metadata.
 * Telemetry failures must not throw into product paths.
 */
export function emitLiveNowStructuredLog(input: LiveNowStructuredLogInput): LiveNowStructuredLogRecord {
  const record: LiveNowStructuredLogRecord = {
    timestamp: new Date().toISOString(),
    service: String(input.service || "live_now").slice(0, 64),
    severity: input.severity,
    event: String(input.event || "ops.event").slice(0, 120),
    correlation_id: sanitizeCorrelationId(input.correlationId) ?? createLiveNowCorrelationId(input.scope ?? "ops_probe"),
    resource_id: input.resourceId ? String(input.resourceId).slice(0, 80) : null,
    error_code: input.errorCode ? String(input.errorCode).slice(0, 80) : null,
  };

  try {
    const level = mapSeverityToLogLevel(input.severity);
    loggingService.log(
      level,
      record.event,
      {
        ...record,
        ...(input.metadata ?? {}),
        ops_critical: input.severity === "CRITICAL",
      },
      `ops:${record.service}`,
    );
  } catch {
    // fail soft
  }

  return record;
}
