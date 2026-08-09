/**
 * TASK34 SLO/SLI definitions for enabled (or soon-enabled) Live Now services.
 * Targets are intentional; historical attainment requires a measured observation window.
 */

export type LiveNowSliDefinition = Readonly<{
  id: string;
  name: string;
  numerator: string;
  denominator: string;
  excludes: readonly string[];
}>;

export type LiveNowSloDefinition = Readonly<{
  id: string;
  serviceKey: string;
  enabledOnly: boolean;
  availabilityTarget: number;
  latencyTargetMsP95: number | null;
  errorRateTarget: number;
  sliId: string;
  measurementNote: string;
}>;

export const LIVE_NOW_SLI_DEFINITIONS: readonly LiveNowSliDefinition[] = Object.freeze([
  {
    id: "sli.live_now_discovery",
    name: "Live Now discovery success",
    numerator: "successful authorized discovery RPC responses",
    denominator: "valid authenticated discovery requests",
    excludes: ["unauthenticated", "attacker auth-denied", "flag-disabled expected denies"],
  },
  {
    id: "sli.go_live_control",
    name: "Go Live control success",
    numerator: "successful start/confirm flow completions",
    denominator: "valid publisher start attempts",
    excludes: ["unauthorized foreign stream control", "suspended publisher expected denies"],
  },
  {
    id: "sli.livekit_signaling",
    name: "LiveKit signaling availability",
    numerator: "successful token+signaling probes",
    denominator: "valid signaling probes",
    excludes: ["media track publish (separate canary)"],
  },
  {
    id: "sli.critical_rpc",
    name: "Critical RPC success",
    numerator: "successful critical Live Now RPCs",
    denominator: "valid critical RPC calls",
    excludes: ["RLS expected denials", "feature-flag OFF denials"],
  },
  {
    id: "sli.live_chat_mutation",
    name: "Live chat mutation success",
    numerator: "successful chat send/moderation mutations when enabled",
    denominator: "valid chat mutation attempts when enableLiveChat=ON",
    excludes: ["rate-limited abuse", "banned users"],
  },
  {
    id: "sli.worker_processing",
    name: "Worker claim/complete success",
    numerator: "successful claim+complete cycles",
    denominator: "claim attempts with work available",
    excludes: ["empty queue idle ticks"],
  },
  {
    id: "sli.notification_processing",
    name: "Notification processing",
    numerator: "SMTP-accepted or inbox-written notifications",
    denominator: "eligible notification jobs",
    excludes: ["suppressed recipients", "mailbox delivery certification"],
  },
]);

export const LIVE_NOW_SLO_DEFINITIONS: readonly LiveNowSloDefinition[] = Object.freeze([
  {
    id: "slo.live_now_discovery_availability",
    serviceKey: "LIVE_NOW_DISCOVERY",
    enabledOnly: true,
    availabilityTarget: 0.995,
    latencyTargetMsP95: 800,
    errorRateTarget: 0.005,
    sliId: "sli.live_now_discovery",
    measurementNote: "Applies only while enableLiveNowDiscovery is ON in the target environment.",
  },
  {
    id: "slo.go_live_control_availability",
    serviceKey: "GO_LIVE_CONTROL",
    enabledOnly: true,
    availabilityTarget: 0.99,
    latencyTargetMsP95: 1500,
    errorRateTarget: 0.01,
    sliId: "sli.go_live_control",
    measurementNote: "Applies only while enableGoLive is ON.",
  },
  {
    id: "slo.livekit_signaling_availability",
    serviceKey: "LIVEKIT_SFU",
    enabledOnly: false,
    availabilityTarget: 0.995,
    latencyTargetMsP95: 1000,
    errorRateTarget: 0.005,
    sliId: "sli.livekit_signaling",
    measurementNote: "Signaling-only; does not certify real two-desktop media.",
  },
  {
    id: "slo.critical_rpc_availability",
    serviceKey: "GO_LIVE_CONTROL",
    enabledOnly: false,
    availabilityTarget: 0.995,
    latencyTargetMsP95: 1200,
    errorRateTarget: 0.005,
    sliId: "sli.critical_rpc",
    measurementNote: "Shared critical RPC envelope for Live Now control plane.",
  },
  {
    id: "slo.live_chat_mutation",
    serviceKey: "LIVE_CHAT",
    enabledOnly: true,
    availabilityTarget: 0.99,
    latencyTargetMsP95: 700,
    errorRateTarget: 0.01,
    sliId: "sli.live_chat_mutation",
    measurementNote: "Enabled-only; two-client realtime remains a separate gate.",
  },
  {
    id: "slo.worker_processing",
    serviceKey: "EMAIL_WORKER",
    enabledOnly: false,
    availabilityTarget: 0.99,
    latencyTargetMsP95: null,
    errorRateTarget: 0.02,
    sliId: "sli.worker_processing",
    measurementNote: "Empty queue idle is not an error.",
  },
  {
    id: "slo.notification_processing",
    serviceKey: "NOTIFICATIONS",
    enabledOnly: false,
    availabilityTarget: 0.99,
    latencyTargetMsP95: null,
    errorRateTarget: 0.02,
    sliId: "sli.notification_processing",
    measurementNote: "SMTP acceptance ≠ mailbox delivery certification.",
  },
]);

export const LIVE_NOW_SLO_OBSERVATION_STATUS = Object.freeze({
  SLO_DEFINITION: "GO" as const,
  SLO_HISTORICAL_ATTAINMENT: "INSUFFICIENT_OBSERVATION_WINDOW" as const,
  ERROR_BUDGET: "NOT_YET_MEASURABLE" as const,
  note: "No trustworthy 30-day production observation window for Live Now Phase1 ops yet. Do not invent 99.9%.",
});

export function percentileRequiresSamples(sampleCount: number, percentile: "p50" | "p95" | "p99"): boolean {
  if (percentile === "p50") return sampleCount >= 10;
  if (percentile === "p95") return sampleCount >= 40;
  return sampleCount >= 100;
}
