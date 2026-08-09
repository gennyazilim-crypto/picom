/**
 * TASK34 — Live Now / Publisher production health model.
 * Disabled / NOT_CONFIGURED / BLOCKED must never collapse into a boolean healthy flag.
 */

export const LIVE_NOW_HEALTH_STATUSES = [
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "DISABLED",
  "NOT_CONFIGURED",
  "UNKNOWN",
  "BLOCKED",
  "NOT_READY",
] as const;

export type LiveNowHealthStatus = (typeof LIVE_NOW_HEALTH_STATUSES)[number];

export const LIVE_NOW_CHECK_KINDS = ["LIVENESS", "READINESS", "DEPENDENCY", "AGGREGATE"] as const;
export type LiveNowCheckKind = (typeof LIVE_NOW_CHECK_KINDS)[number];

export const LIVE_NOW_SERVICE_KEYS = [
  "LIVE_NOW_DISCOVERY",
  "GO_LIVE_CONTROL",
  "LIVEKIT_SFU",
  "LIVEKIT_INGRESS",
  "LIVE_CHAT",
  "PUBLISHER_ANALYTICS",
  "RECORDING_PIPELINE",
  "NOTIFICATIONS",
  "EMAIL_WORKER",
  "REMINDER_WORKER",
  "PUBLISHER_APPLICATIONS",
  "CREATOR_STUDIO",
  "MONETIZATION",
  "KYC_PAYOUT",
] as const;

export type LiveNowServiceKey = (typeof LIVE_NOW_SERVICE_KEYS)[number];

export const LIVE_NOW_LOG_SEVERITIES = ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"] as const;
export type LiveNowLogSeverity = (typeof LIVE_NOW_LOG_SEVERITIES)[number];

export const LIVE_NOW_ALERT_SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
export type LiveNowAlertSeverity = (typeof LIVE_NOW_ALERT_SEVERITIES)[number];

export const LIVE_NOW_ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
export type LiveNowAlertStatus = (typeof LIVE_NOW_ALERT_STATUSES)[number];

export type LiveNowServiceCatalogEntry = Readonly<{
  key: LiveNowServiceKey;
  ownerComponent: string;
  productionEnabled: boolean;
  featureFlag: string | null;
  dependencies: readonly string[];
  healthMethod: string;
  failureMode: string;
  userImpact: string;
  certificationStatus: string;
  runbook: string;
  healthStatus: LiveNowHealthStatus;
}>;

/** Canonical catalog — status reflects production fail-closed flags + historical gates. */
export const LIVE_NOW_SERVICE_CATALOG: readonly LiveNowServiceCatalogEntry[] = Object.freeze([
  {
    key: "LIVE_NOW_DISCOVERY",
    ownerComponent: "publisher discovery RPC + Desktop Live Now surface",
    productionEnabled: false,
    featureFlag: "enableLiveNowDiscovery",
    dependencies: ["Supabase Auth", "Postgres RPC", "feature flags"],
    healthMethod: "authorized discovery RPC + flag consistency",
    failureMode: "empty/error module state; fail-closed when flag OFF",
    userImpact: "cannot browse Live Now",
    certificationStatus: "PHASE1_PARTIAL",
    runbook: "docs/publisher-creator/LIVE_NOW_OPERATIONS_RUNBOOK.md",
    healthStatus: "DISABLED",
  },
  {
    key: "GO_LIVE_CONTROL",
    ownerComponent: "GoLiveWorkspace + stream lifecycle RPCs",
    productionEnabled: false,
    featureFlag: "enableGoLive",
    dependencies: ["Auth", "DB", "LiveKit token edge", "kill switches"],
    healthMethod: "start/confirm/end RPC success ratio",
    failureMode: "publish denied; no duplicate start on retry",
    userImpact: "publishers cannot go live",
    certificationStatus: "PHASE1_PARTIAL",
    runbook: "docs/publisher-creator/LIVE_NOW_OPERATIONS_RUNBOOK.md",
    healthStatus: "DISABLED",
  },
  {
    key: "LIVEKIT_SFU",
    ownerComponent: "self-hosted LiveKit at voice.picom.gg",
    productionEnabled: true,
    featureFlag: null,
    dependencies: ["DNS", "TLS:443", "Redis/TURN config", "livekit-token"],
    healthMethod: "admin-health ListRooms probe + signaling canary",
    failureMode: "signaling unavailable; media separate certification",
    userImpact: "voice/live join fails",
    certificationStatus: "SIGNALING_SEPARATE; REAL_TWO_DESKTOP_MEDIA_NOT_CERTIFIED",
    runbook: "docs/publisher-creator/LIVE_NOW_INCIDENT_RESPONSE.md",
    healthStatus: "UNKNOWN",
  },
  {
    key: "LIVEKIT_INGRESS",
    ownerComponent: "RTMP Ingress + livekit-ingress edge",
    productionEnabled: true,
    featureFlag: "enablePublisherExternalIngest",
    dependencies: ["LiveKit SFU", "webhook", "stream credentials"],
    healthMethod: "container liveness + RTMP listener + API",
    failureMode: "external ingest unavailable; OBS client not certified",
    userImpact: "OBS/RTMP publish fails",
    certificationStatus: "OBS_REAL_CLIENT_NOT_RUN",
    runbook: "docs/publisher-creator/STREAM_CREDENTIAL_SECURITY.md",
    healthStatus: "UNKNOWN",
  },
  {
    key: "LIVE_CHAT",
    ownerComponent: "live chat RPCs + moderation",
    productionEnabled: false,
    featureFlag: "enableLiveChat",
    dependencies: ["Auth", "Realtime", "moderation RPCs"],
    healthMethod: "mutation RPC + rate-limit counters",
    failureMode: "chat send/moderation denied",
    userImpact: "live chat unavailable",
    certificationStatus: "CHAT_TWO_CLIENT_NOT_RUN",
    runbook: "docs/publisher-creator/LIVE_CHAT_SECURITY.md",
    healthStatus: "DISABLED",
  },
  {
    key: "PUBLISHER_ANALYTICS",
    ownerComponent: "analytics rollups + finalization",
    productionEnabled: false,
    featureFlag: "enablePublisherAnalytics",
    dependencies: ["DB", "stream lifecycle"],
    healthMethod: "rollup job + aggregate RPC",
    failureMode: "stale/empty analytics",
    userImpact: "publisher dashboards empty",
    certificationStatus: "ANALYTICS_MULTI_VIEWER_NOT_RUN",
    runbook: "docs/publisher-creator/PUBLISHER_ANALYTICS_ARCHITECTURE.md",
    healthStatus: "DISABLED",
  },
  {
    key: "RECORDING_PIPELINE",
    ownerComponent: "LiveKit Egress + media worker + object storage",
    productionEnabled: false,
    featureFlag: "enableLiveRecording",
    dependencies: ["Egress capacity", "S3 credentials", "media worker"],
    healthMethod: "config gate (not outage)",
    failureMode: "jobs remain queued / reject",
    userImpact: "recording/replay/clips unavailable",
    certificationStatus: "BLOCKED_INFRASTRUCTURE + BLOCKED_STORAGE_CREDENTIAL",
    runbook: "docs/publisher-creator/LIVE_RECORDING_ARCHITECTURE.md",
    healthStatus: "BLOCKED",
  },
  {
    key: "NOTIFICATIONS",
    ownerComponent: "inbox + email templates",
    productionEnabled: true,
    featureFlag: "enablePublisherReminders",
    dependencies: ["EMAIL_WORKER", "DB queues"],
    healthMethod: "queue backlog + delivery outcomes",
    failureMode: "delayed notifications",
    userImpact: "missed reminders / security mail delay",
    certificationStatus: "SMTP_CONNECTION_SEPARATE_FROM_INBOX",
    runbook: "docs/publisher-creator/LIVE_NOW_OPERATIONS_RUNBOOK.md",
    healthStatus: "UNKNOWN",
  },
  {
    key: "EMAIL_WORKER",
    ownerComponent: "services/email-worker",
    productionEnabled: true,
    featureFlag: null,
    dependencies: ["Supabase service role", "SMTP"],
    healthMethod: "127.0.0.1 health + email_worker_heartbeats",
    failureMode: "queue grows; SMTP degraded",
    userImpact: "transactional email delay",
    certificationStatus: "AUTH_INBOX_BLOCKED_RATE_LIMIT",
    runbook: "docs/publisher-creator/LIVE_NOW_INCIDENT_RESPONSE.md",
    healthStatus: "UNKNOWN",
  },
  {
    key: "REMINDER_WORKER",
    ownerComponent: "services/event-reminder-worker",
    productionEnabled: true,
    featureFlag: "enablePublisherReminders",
    dependencies: ["DB claim RPCs", "notification insert"],
    healthMethod: "claim success + pending age",
    failureMode: "late reminders; idle empty queue is not failure",
    userImpact: "schedule reminders delayed",
    certificationStatus: "WORKER_PROCESS_EXTERNAL",
    runbook: "docs/publisher-creator/LIVE_NOW_DISASTER_RECOVERY.md",
    healthStatus: "UNKNOWN",
  },
  {
    key: "PUBLISHER_APPLICATIONS",
    ownerComponent: "publisher application/review RPCs",
    productionEnabled: false,
    featureFlag: "enablePublisherApplication",
    dependencies: ["Auth", "admin review"],
    healthMethod: "application RPC + review queue",
    failureMode: "apply/review unavailable",
    userImpact: "cannot apply for publisher",
    certificationStatus: "PHASE1_PARTIAL",
    runbook: "docs/publisher-creator/PUBLISHER_CREATOR_ARCHITECTURE.md",
    healthStatus: "DISABLED",
  },
  {
    key: "CREATOR_STUDIO",
    ownerComponent: "PublisherCreatorStudioWorkspace + team RBAC",
    productionEnabled: false,
    featureFlag: "enableCreatorStudio",
    dependencies: ["team permissions", "child feature flags"],
    healthMethod: "flag + get_my_publisher_studio_readiness",
    failureMode: "legacy dashboard fallback when OFF",
    userImpact: "unified studio shell unavailable",
    certificationStatus: "PARTIAL_RUNTIME_TEAM_CERTIFICATION",
    runbook: "docs/publisher-creator/CREATOR_STUDIO_OPERATIONS.md",
    healthStatus: "DISABLED",
  },
  {
    key: "MONETIZATION",
    ownerComponent: "publisher monetization ledger + edge",
    productionEnabled: false,
    featureFlag: "enablePublisherMonetization",
    dependencies: ["payment provider", "legal terms"],
    healthMethod: "provider config gate",
    failureMode: "NOT_CONFIGURED fail-closed",
    userImpact: "earnings/payments unavailable",
    certificationStatus: "PAYMENT_PROVIDER_BLOCKED; LIVE_PAYMENT_OFF",
    runbook: "docs/publisher-creator/FINANCE_OPERATIONS_RUNBOOK.md",
    healthStatus: "NOT_CONFIGURED",
  },
  {
    key: "KYC_PAYOUT",
    ownerComponent: "KYC/tax/payout engine",
    productionEnabled: false,
    featureFlag: "enablePublisherPayouts",
    dependencies: ["KYC provider", "payout provider", "tax/legal"],
    healthMethod: "provider config gate",
    failureMode: "NOT_CONFIGURED fail-closed",
    userImpact: "cannot payout",
    certificationStatus: "KYC/PAYOUT NOT_CONFIGURED; LIVE_PAYOUT_OFF",
    runbook: "docs/publisher-creator/PAYOUT_OPERATIONS_RUNBOOK.md",
    healthStatus: "NOT_CONFIGURED",
  },
]);

export function isOperationallyHealthy(status: LiveNowHealthStatus): boolean {
  return status === "HEALTHY";
}

export function isAvailabilityFailure(status: LiveNowHealthStatus): boolean {
  return status === "UNAVAILABLE" || status === "DEGRADED";
}
