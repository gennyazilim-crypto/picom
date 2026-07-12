export type VoiceHostingMode = "SELF_HOSTED_LIVEKIT";
export type VoiceInfrastructureEnvironment = "development" | "staging" | "production";

export const voiceInfrastructureContract = Object.freeze({
  hostingMode: "SELF_HOSTED_LIVEKIT" as VoiceHostingMode,
  cloudSubscriptionRequired: false,
  productScope: "IN_V1" as const,
  publicReleaseReadiness: "BLOCKED_PENDING_SELF_HOSTED_CERTIFICATION" as const,
  ordinaryMediaAccess: "ACTIVE_COMMUNITY_MEMBER" as const,
  environments: Object.freeze<Record<VoiceInfrastructureEnvironment, Readonly<{
    deployment: "local" | "dedicated-self-hosted";
    credentials: "development-only" | "environment-isolated";
  }>>>({
    development: Object.freeze({ deployment: "local", credentials: "development-only" }),
    staging: Object.freeze({ deployment: "dedicated-self-hosted", credentials: "environment-isolated" }),
    production: Object.freeze({ deployment: "dedicated-self-hosted", credentials: "environment-isolated" }),
  }),
  requiredEvidenceTasks: Object.freeze([658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 671, 672, 673] as const),
  finalInclusionConfirmationTask: 674,
  excludedCapabilities: Object.freeze(["recording", "egress", "sip", "ingress", "camera-meetings", "captions", "ai-summaries", "external-livestreaming"] as const),
});
