/**
 * Deterministic security / abuse monitoring event codes for Live Now ops.
 * Counters must stay aggregate — no raw user_id / IP / message body labels.
 */

export const LIVE_NOW_SECURITY_EVENT_CODES = Object.freeze([
  "AUTH_DENIAL_REPEATED",
  "STREAM_CREDENTIAL_ROTATED",
  "STREAM_CREDENTIAL_REVOKED",
  "UNAUTHORIZED_STREAM_MANAGEMENT",
  "CHAT_MODERATION_ABUSE",
  "TEAM_PRIVILEGE_ESCALATION_DENIED",
  "FINANCE_PERMISSION_DENIED",
  "PAYOUT_DENIED",
  "WEBHOOK_SIGNATURE_FAILURE",
  "RLS_VIOLATION_OBSERVED",
  "RATE_LIMIT_ABUSE",
] as const);

export type LiveNowSecurityEventCode = (typeof LIVE_NOW_SECURITY_EVENT_CODES)[number];

export const LIVE_NOW_ABUSE_COUNTER_KEYS = Object.freeze([
  "chat_flood",
  "invite_abuse",
  "stream_creation_abuse",
  "go_live_failure_abuse",
  "report_spam",
  "credential_rotation_abuse",
  "payment_endpoint_abuse",
] as const);

export type LiveNowAbuseCounterKey = (typeof LIVE_NOW_ABUSE_COUNTER_KEYS)[number];

export type LiveNowAnomalyRule = Readonly<{
  id: string;
  counterKey: string;
  threshold: number;
  window: "5m" | "15m" | "1h";
  severity: "SEV2" | "SEV3" | "SEV4";
  description: string;
}>;

export const LIVE_NOW_ANOMALY_RULES: readonly LiveNowAnomalyRule[] = Object.freeze([
  {
    id: "anomaly.go_live_failures",
    counterKey: "go_live_failure_abuse",
    threshold: 25,
    window: "15m",
    severity: "SEV3",
    description: "Excessive Go Live failures (deterministic threshold, not AI fraud).",
  },
  {
    id: "anomaly.credential_rotations",
    counterKey: "credential_rotation_abuse",
    threshold: 10,
    window: "1h",
    severity: "SEV2",
    description: "Credential rotations above threshold.",
  },
  {
    id: "anomaly.chat_ban_spike",
    counterKey: "chat_flood",
    threshold: 50,
    window: "15m",
    severity: "SEV3",
    description: "Chat flood / ban spike signal.",
  },
  {
    id: "anomaly.webhook_signatures",
    counterKey: "webhook_signature_failure",
    threshold: 20,
    window: "15m",
    severity: "SEV2",
    description: "High webhook signature failure rate.",
  },
  {
    id: "anomaly.invite_creation",
    counterKey: "invite_abuse",
    threshold: 30,
    window: "1h",
    severity: "SEV3",
    description: "Rapid team invite creation attempts.",
  },
]);

export const LIVE_NOW_ABUSE_MATRIX_EXPECTATIONS = Object.freeze([
  { caseId: "foreign_stream_control", expected: "FAIL_CLOSED" },
  { caseId: "unauthorized_go_live", expected: "FAIL_CLOSED" },
  { caseId: "foreign_credential_rotate", expected: "FAIL_CLOSED" },
  { caseId: "reused_credential", expected: "FAIL_CLOSED" },
  { caseId: "suspended_publisher_attempt", expected: "FAIL_CLOSED" },
] as const);
