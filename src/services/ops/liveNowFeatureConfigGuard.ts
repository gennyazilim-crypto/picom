import type { FeatureFlags } from "../featureFlagService";

export type FeatureConfigViolation = Readonly<{
  code: string;
  severity: "SEV1" | "SEV2" | "SEV3";
  note?: string;
}>;

export type FeatureConfigConsistencyResult = Readonly<{
  ok: boolean;
  violations: readonly FeatureConfigViolation[];
}>;

/**
 * Detect impossible Live Now / Publisher configurations.
 * Does not enable features — only evaluates a flag snapshot.
 */
export function evaluateLiveNowFeatureConfigConsistency(flags: FeatureFlags): FeatureConfigConsistencyResult {
  const violations: FeatureConfigViolation[] = [];

  if (flags.enablePublisherExternalIngest && !flags.enablePublisherStreamManagement) {
    violations.push({ code: "EXTERNAL_INGEST_WITHOUT_STREAM_MGMT", severity: "SEV2" });
  }

  if (flags.enableLiveRecording || flags.enableLiveReplays || flags.enableLiveClips) {
    violations.push({
      code: "RECORDING_ON_WHILE_EGRESS_BLOCKED",
      severity: "SEV2",
      note: "LIVEKIT_EGRESS_BLOCKED_INFRASTRUCTURE / MEDIA_STORAGE_BLOCKED_STORAGE_CREDENTIAL",
    });
  }

  if (flags.enablePublisherPayouts) {
    violations.push({
      code: "PAYOUT_ON_WITHOUT_PROVIDER",
      severity: "SEV1",
      note: "PAYOUT_PROVIDER_NOT_CONFIGURED",
    });
  }

  if (
    flags.enablePublisherMonetization
    || flags.enablePublisherSubscriptions
    || flags.enablePublisherDonations
    || flags.enablePublisherAdRevenue
  ) {
    violations.push({
      code: "MONETIZATION_ON_WITHOUT_PROVIDER",
      severity: "SEV1",
      note: "PAYMENT_PROVIDER_BLOCKED_PROVIDER_CONFIGURATION",
    });
  }

  if (flags.enableLiveModeration && !flags.enableLiveChat) {
    violations.push({ code: "MODERATION_WITHOUT_CHAT", severity: "SEV3" });
  }

  if (flags.enableCreatorStudio) {
    // Shell may be ON while children OFF — allowed. Warn only if finance surfaces ON without KYC/payout readiness.
    if (flags.enablePublisherEarningsDashboard && flags.enablePublisherPayouts) {
      violations.push({
        code: "STUDIO_FINANCE_WITHOUT_PROVIDER",
        severity: "SEV1",
        note: "KYC_PAYOUT_NOT_CONFIGURED",
      });
    }
  }

  if (flags.enablePublisherExternalIngest) {
    // Ingress process health is runtime-evaluated separately; flag ON without OBS cert is product risk SEV3.
    violations.push({
      code: "EXTERNAL_INGEST_WITHOUT_OBS_CERT",
      severity: "SEV3",
      note: "OBS_REAL_CLIENT_NOT_RUN",
    });
  }

  return { ok: violations.length === 0, violations };
}

/** Production defaults must remain fail-closed for Task27–33 child surfaces. */
export function assertProductionPublisherFlagsFailClosed(flags: FeatureFlags): FeatureConfigConsistencyResult {
  const requiredOff: Array<keyof FeatureFlags> = [
    "enableLiveNowDiscovery",
    "enableGoLive",
    "enablePublisherStreamManagement",
    "enablePublisherExternalIngest",
    "enableLiveChat",
    "enableLiveModeration",
    "enablePublisherAnalytics",
    "enableLiveRecording",
    "enableLiveReplays",
    "enableLiveClips",
    "enablePublisherMonetization",
    "enablePublisherSubscriptions",
    "enablePublisherDonations",
    "enablePublisherAdRevenue",
    "enablePublisherEarningsDashboard",
    "enablePublisherKyc",
    "enablePublisherTaxProfile",
    "enablePublisherPayoutAccounts",
    "enablePublisherPayouts",
    "enablePublisherStatements",
    "enableCreatorStudio",
  ];

  const violations: FeatureConfigViolation[] = requiredOff
    .filter((key) => flags[key] === true)
    .map((key) => ({
      code: `PRODUCTION_FLAG_UNEXPECTEDLY_ON:${String(key)}`,
      severity: "SEV1" as const,
      note: "Task34 must not enable features merely to probe",
    }));

  return { ok: violations.length === 0, violations };
}
