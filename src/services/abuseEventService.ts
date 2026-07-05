import { loggingService } from "./loggingService";

export type AbuseEventType =
  | "repeated_failed_login"
  | "rate_limit_exceeded"
  | "upload_rejected"
  | "webhook_rate_limit"
  | "invite_abuse_placeholder"
  | "blocked_words_hit"
  | "suspicious_attachment"
  | "unauthorized_private_channel_access"
  | "invalid_deep_link_abuse_placeholder";

export type AbuseEventSeverity = "info" | "warning" | "critical";

export type AbuseEventInput = Readonly<{
  type: AbuseEventType;
  reason: string;
  userId?: string;
  communityId?: string;
  channelId?: string;
  targetId?: string;
  requestId?: string;
  ipHashPlaceholder?: string;
  severity?: AbuseEventSeverity;
  metadata?: unknown;
}>;

export type AbuseEventRecord = Readonly<{
  id: string;
  type: AbuseEventType;
  reason: string;
  userId?: string;
  communityId?: string;
  channelId?: string;
  targetId?: string;
  requestId?: string;
  ipHashPlaceholder?: string;
  severity: AbuseEventSeverity;
  timestamp: string;
  metadata?: unknown;
  privateContentStored: false;
}>;

export type AbuseEventSummary = Readonly<{
  total: number;
  critical: number;
  warning: number;
  byType: Partial<Record<AbuseEventType, number>>;
  recentEvents: AbuseEventRecord[];
  placeholder: true;
}>;

const MAX_ABUSE_EVENTS = 200;
const abuseEvents: AbuseEventRecord[] = [];
let abuseCounter = 0;
const PRIVATE_METADATA_KEY_PATTERN = /(password|token|secret|authorization|cookie|raw[-_]?ip|ip[-_]?address|message[-_]?content|message[-_]?body|message[-_]?text|body|content|private[-_]?data|session|jwt|api[-_]?key)/i;

function createAbuseEventId(): string {
  abuseCounter += 1;
  return `abuse-${Date.now()}-${abuseCounter}`;
}

function sanitizeAbuseMetadata(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAbuseMetadata(item, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        PRIVATE_METADATA_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitizeAbuseMetadata(nestedValue, seen)
      ])
    );
  }

  return value;
}

function getDefaultSeverity(type: AbuseEventType): AbuseEventSeverity {
  if (type === "unauthorized_private_channel_access" || type === "suspicious_attachment") {
    return "critical";
  }

  if (type === "rate_limit_exceeded" || type === "repeated_failed_login" || type === "blocked_words_hit") {
    return "warning";
  }

  return "info";
}

function cloneEvent(event: AbuseEventRecord): AbuseEventRecord {
  return {
    ...event,
    metadata: event.metadata === undefined ? undefined : loggingService.redactDiagnosticsValue(event.metadata)
  };
}

export const abuseEventService = {
  recordEvent(input: AbuseEventInput): AbuseEventRecord {
    const severity = input.severity ?? getDefaultSeverity(input.type);
    const metadata = input.metadata === undefined
      ? undefined
      : loggingService.redactDiagnosticsValue(sanitizeAbuseMetadata(input.metadata));
    const event: AbuseEventRecord = {
      id: createAbuseEventId(),
      type: input.type,
      reason: input.reason.slice(0, 240),
      userId: input.userId,
      communityId: input.communityId,
      channelId: input.channelId,
      targetId: input.targetId,
      requestId: input.requestId,
      ipHashPlaceholder: input.ipHashPlaceholder,
      severity,
      timestamp: new Date().toISOString(),
      metadata,
      privateContentStored: false
    };

    abuseEvents.unshift(event);
    if (abuseEvents.length > MAX_ABUSE_EVENTS) {
      abuseEvents.splice(MAX_ABUSE_EVENTS);
    }

    loggingService.logWarn("Abuse event recorded", {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      communityId: event.communityId,
      channelId: event.channelId,
      targetId: event.targetId,
      requestId: event.requestId,
      reason: event.reason,
      metadata: event.metadata,
      privateContentStored: false
    }, "abuse-events");

    return cloneEvent(event);
  },

  getRecentEvents(limit = 25): AbuseEventRecord[] {
    return abuseEvents.slice(0, limit).map(cloneEvent);
  },

  getAdminSummary(): AbuseEventSummary {
    const byType = abuseEvents.reduce<Partial<Record<AbuseEventType, number>>>((summary, event) => {
      summary[event.type] = (summary[event.type] ?? 0) + 1;
      return summary;
    }, {});

    return {
      total: abuseEvents.length,
      critical: abuseEvents.filter((event) => event.severity === "critical").length,
      warning: abuseEvents.filter((event) => event.severity === "warning").length,
      byType,
      recentEvents: this.getRecentEvents(5),
      placeholder: true
    };
  },

  formatUserMessage(type: AbuseEventType): string {
    if (type === "rate_limit_exceeded") {
      return "You are doing that too quickly. Please wait a moment and try again.";
    }

    if (type === "upload_rejected" || type === "suspicious_attachment") {
      return "This upload could not be accepted for safety reasons.";
    }

    if (type === "unauthorized_private_channel_access") {
      return "You do not have access to that private channel.";
    }

    return "That action could not be completed safely.";
  },

  clearLocalEvents(): void {
    abuseEvents.length = 0;
  }
};
