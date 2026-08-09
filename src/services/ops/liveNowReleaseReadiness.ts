export type GateCell =
  | "GO"
  | "PARTIAL"
  | "BLOCKED"
  | "NOT_RUN"
  | "NOT_CONFIGURED"
  | "OFF"
  | "N/A";

export type ReleaseReadinessRow = Readonly<{
  component: string;
  code: GateCell;
  database: GateCell;
  rls: GateCell;
  unitStatic: GateCell;
  productionRuntime: GateCell;
  realClient: GateCell;
  externalProvider: GateCell;
  featureFlag: GateCell;
  final: GateCell;
}>;

export type ReleaseTier = "INTERNAL" | "CONTROLLED_BETA" | "PUBLIC_BETA" | "GENERAL_AVAILABILITY";

export type ReleaseTierGate = Readonly<{
  tier: ReleaseTier;
  minimumGates: readonly string[];
  verdict: GateCell;
  rationale: string;
}>;

export const LIVE_NOW_RELEASE_READINESS_MATRIX: readonly ReleaseReadinessRow[] = Object.freeze([
  {
    component: "Publisher applications",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Publisher review",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Badge",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Live Now discovery",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Go Live",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "LiveKit signaling",
    code: "GO",
    database: "N/A",
    rls: "N/A",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "GO",
    featureFlag: "N/A",
    final: "PARTIAL",
  },
  {
    component: "Real media",
    code: "GO",
    database: "N/A",
    rls: "N/A",
    unitStatic: "PARTIAL",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "GO",
    featureFlag: "N/A",
    final: "BLOCKED",
  },
  {
    component: "OBS / external ingest",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "NOT_RUN",
    externalProvider: "PARTIAL",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "Chat",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "NOT_RUN",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Analytics",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "NOT_RUN",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Recording",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "BLOCKED",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "Replay / Clips",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "BLOCKED",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "Creator Studio",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "PARTIAL",
    externalProvider: "N/A",
    featureFlag: "OFF",
    final: "PARTIAL",
  },
  {
    component: "Monetization",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "NOT_CONFIGURED",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "KYC",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "NOT_CONFIGURED",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "Payout",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "BLOCKED",
    realClient: "NOT_RUN",
    externalProvider: "NOT_CONFIGURED",
    featureFlag: "OFF",
    final: "BLOCKED",
  },
  {
    component: "Operations / observability",
    code: "GO",
    database: "GO",
    rls: "GO",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "N/A",
    externalProvider: "NOT_CONFIGURED",
    featureFlag: "N/A",
    final: "PARTIAL",
  },
  {
    component: "Disaster recovery",
    code: "GO",
    database: "PARTIAL",
    rls: "N/A",
    unitStatic: "GO",
    productionRuntime: "PARTIAL",
    realClient: "N/A",
    externalProvider: "PARTIAL",
    featureFlag: "N/A",
    final: "PARTIAL",
  },
]);

export const LIVE_NOW_RELEASE_TIERS: readonly ReleaseTierGate[] = Object.freeze([
  {
    tier: "INTERNAL",
    minimumGates: [
      "schema/RLS for Phase1 surfaces",
      "fail-closed production flags",
      "ops health model + docs",
      "no public enablement required",
    ],
    verdict: "GO",
    rationale: "Internal ops/docs/contracts + sealed Phase1 schema are sufficient for INTERNAL use with flags OFF.",
  },
  {
    tier: "CONTROLLED_BETA",
    minimumGates: [
      "Live Now discovery + Go Live enableable for allowlisted publishers",
      "LiveKit signaling canary",
      "abuse fail-closed matrix",
      "kill switches documented",
    ],
    verdict: "GO",
    rationale: "Control-plane + signaling exist; beta must keep media/OBS/recording/payment gates explicit and opt-in.",
  },
  {
    tier: "PUBLIC_BETA",
    minimumGates: [
      "REAL TWO-DESKTOP MEDIA certified OR explicit media disclaimer + limited cohort",
      "chat two-client runtime OR chat OFF",
      "auth inbox delivery path not BLOCKED_RATE_LIMIT for security mail",
      "ops alerting transport configured",
    ],
    verdict: "PARTIAL",
    rationale: "Media NOT_CERTIFIED, chat two-client NOT_RUN, auth inbox BLOCKED_RATE_LIMIT, alert transport NOT_CONFIGURED.",
  },
  {
    tier: "GENERAL_AVAILABILITY",
    minimumGates: [
      "real media certified",
      "OBS real client if ingest advertised",
      "chat/analytics runtime gates closed if advertised",
      "recording ready or not advertised",
      "payment/KYC/payout providers configured if monetization advertised",
      "SLO observation window + alert transport",
      "DR restore drill evidence",
    ],
    verdict: "BLOCKED",
    rationale: "Historical Task26–33 blockers remain open; GA cannot be declared.",
  },
]);

export const HISTORICAL_BLOCKERS_PRESERVED = Object.freeze([
  "REAL_TWO_DESKTOP_MEDIA: NOT_CERTIFIED",
  "AUTH_INBOX: BLOCKED_RATE_LIMIT",
  "OBS_REAL_CLIENT: NOT_RUN",
  "CHAT_TWO_CLIENT: NOT_RUN",
  "ANALYTICS_MULTI_VIEWER: NOT_RUN",
  "LIVEKIT_EGRESS: BLOCKED_INFRASTRUCTURE",
  "MEDIA_STORAGE: BLOCKED_STORAGE_CREDENTIAL",
  "PAYMENT_PROVIDER: BLOCKED_PROVIDER_CONFIGURATION",
  "LIVE_PAYMENT: OFF",
  "LEGAL: BLOCKED_CONTENT_APPROVAL",
  "KYC_PROVIDER: NOT_CONFIGURED",
  "PAYOUT_PROVIDER: NOT_CONFIGURED",
  "LIVE_PAYOUT: OFF",
  "TAX_ENGINE: BLOCKED_LEGAL_PROVIDER_CONFIGURATION",
  "CREATOR_STUDIO_SECURITY_CENTER: PARTIAL_AUTH_PROVIDER_CAPABILITY",
  "CREATOR_STUDIO_PRODUCTION: PARTIAL_RUNTIME_TEAM_CERTIFICATION",
] as const);
