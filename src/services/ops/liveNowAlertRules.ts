import type { LiveNowAlertSeverity } from "./liveNowHealthModel";

export type LiveNowAlertRule = Readonly<{
  id: string;
  dedupeKeyTemplate: string;
  severity: LiveNowAlertSeverity;
  serviceKey: string;
  eventCode: string;
  condition: string;
  recoverySignal: string;
  transportRequired: boolean;
}>;

export const LIVE_NOW_ALERT_TRANSPORT = "NOT_CONFIGURED" as const;

export const LIVE_NOW_ALERT_RULES: readonly LiveNowAlertRule[] = Object.freeze([
  {
    id: "alert.live_now_global_unavailable",
    dedupeKeyTemplate: "live_now:global_unavailable",
    severity: "SEV1",
    serviceKey: "LIVE_NOW_DISCOVERY",
    eventCode: "LIVE_NOW_GLOBAL_UNAVAILABLE",
    condition: "Discovery + Go Live both UNAVAILABLE while flags ON",
    recoverySignal: "both surfaces return HEALTHY/DEGRADED with successful canary",
    transportRequired: true,
  },
  {
    id: "alert.security_compromise",
    dedupeKeyTemplate: "security:compromise:{resource}",
    severity: "SEV1",
    serviceKey: "CREATOR_STUDIO",
    eventCode: "SECURITY_COMPROMISE_SUSPECTED",
    condition: "Confirmed credential leak / unauthorized finance access",
    recoverySignal: "credentials revoked + audit closed",
    transportRequired: true,
  },
  {
    id: "alert.finance_unauthorized",
    dedupeKeyTemplate: "finance:unauthorized_access",
    severity: "SEV1",
    serviceKey: "KYC_PAYOUT",
    eventCode: "UNAUTHORIZED_FINANCE_ACCESS",
    condition: "Repeated finance permission denials escalating or successful bypass attempt",
    recoverySignal: "access path closed + owner ack",
    transportRequired: true,
  },
  {
    id: "alert.livekit_degraded",
    dedupeKeyTemplate: "livekit:signaling_degraded",
    severity: "SEV2",
    serviceKey: "LIVEKIT_SFU",
    eventCode: "LIVEKIT_SIGNALING_DEGRADED",
    condition: "admin-health ListRooms probe fail or latency spike sustained 5m",
    recoverySignal: "probe HEALTHY for 10m",
    transportRequired: true,
  },
  {
    id: "alert.worker_backlog",
    dedupeKeyTemplate: "worker:email_backlog",
    severity: "SEV2",
    serviceKey: "EMAIL_WORKER",
    eventCode: "EMAIL_QUEUE_BACKLOG",
    condition: "email pending+retry exceeds threshold with growing oldest_pending_age",
    recoverySignal: "backlog below threshold",
    transportRequired: true,
  },
  {
    id: "alert.ingress_global_failure",
    dedupeKeyTemplate: "ingress:global_failure",
    severity: "SEV2",
    serviceKey: "LIVEKIT_INGRESS",
    eventCode: "INGRESS_GLOBAL_FAILURE",
    condition: "Ingress API/RTMP listener down while external ingest enabled",
    recoverySignal: "listener+API ready",
    transportRequired: true,
  },
  {
    id: "alert.critical_rpc_spike",
    dedupeKeyTemplate: "rpc:critical_error_spike",
    severity: "SEV2",
    serviceKey: "GO_LIVE_CONTROL",
    eventCode: "CRITICAL_RPC_ERROR_SPIKE",
    condition: "error_rate for critical RPCs exceeds SLO target over window",
    recoverySignal: "error_rate within budget",
    transportRequired: true,
  },
  {
    id: "alert.isolated_worker_failure",
    dedupeKeyTemplate: "worker:isolated_failure:{worker}",
    severity: "SEV3",
    serviceKey: "REMINDER_WORKER",
    eventCode: "WORKER_ISOLATED_FAILURE",
    condition: "single worker heartbeat degraded without global outage",
    recoverySignal: "heartbeat healthy",
    transportRequired: false,
  },
  {
    id: "alert.notification_delay",
    dedupeKeyTemplate: "notifications:delay",
    severity: "SEV3",
    serviceKey: "NOTIFICATIONS",
    eventCode: "NOTIFICATION_DELAY",
    condition: "notification lag elevated but core live path healthy",
    recoverySignal: "lag normalized",
    transportRequired: false,
  },
  {
    id: "alert.module_degradation",
    dedupeKeyTemplate: "module:degraded:{service}",
    severity: "SEV3",
    serviceKey: "PUBLISHER_ANALYTICS",
    eventCode: "MODULE_DEGRADED",
    condition: "single module DEGRADED",
    recoverySignal: "module HEALTHY or DISABLED intentionally",
    transportRequired: false,
  },
  {
    id: "alert.capacity_trend",
    dedupeKeyTemplate: "capacity:disk_trend",
    severity: "SEV4",
    serviceKey: "LIVEKIT_SFU",
    eventCode: "CAPACITY_TREND",
    condition: "disk/CPU trend approaching threshold without user impact",
    recoverySignal: "trend cleared",
    transportRequired: false,
  },
  {
    id: "alert.webhook_signature_failures",
    dedupeKeyTemplate: "webhook:signature_failures:{provider}",
    severity: "SEV2",
    serviceKey: "LIVEKIT_INGRESS",
    eventCode: "WEBHOOK_SIGNATURE_FAILURE_RATE",
    condition: "high webhook signature failure rate in window",
    recoverySignal: "failure rate below threshold",
    transportRequired: true,
  },
  {
    id: "alert.recording_misconfig",
    dedupeKeyTemplate: "recording:flag_on_blocked",
    severity: "SEV2",
    serviceKey: "RECORDING_PIPELINE",
    eventCode: "RECORDING_FLAG_WHILE_BLOCKED",
    condition: "enableLiveRecording ON while Egress/storage blocked",
    recoverySignal: "flag OFF or infrastructure ready",
    transportRequired: true,
  },
]);

export function buildAlertDedupeKey(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (!value) return "unknown";
    return String(value).toLowerCase().replace(/[^a-z0-9._:-]/g, "").slice(0, 48);
  });
}
