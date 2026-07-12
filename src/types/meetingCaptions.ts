export type MeetingCaptionStatus = "idle" | "awaiting_consent" | "starting" | "active" | "stopping" | "stopped" | "failed" | "unavailable";
export type MeetingCaptionLanguage = "en" | "tr" | "de" | "es" | "fr";
export type MeetingCaptionFontSize = "small" | "medium" | "large";
export type MeetingCaptionConsentDecision = "accepted" | "declined" | null;

export type MeetingCaptionSegment = Readonly<{
  id: string;
  speakerIdentity: string;
  speakerName: string;
  text: string;
  isFinal: boolean;
  receivedAt: string;
}>;

export type MeetingCaptionSnapshot = Readonly<{
  roomId: string | null;
  sessionId: string | null;
  configured: boolean;
  provider: "deepgram_livekit_agent";
  model: "nova-3";
  status: MeetingCaptionStatus;
  language: MeetingCaptionLanguage;
  retentionMode: "ephemeral";
  policyVersion: string;
  canStart: boolean;
  consentDecision: MeetingCaptionConsentDecision;
  consentRequired: boolean;
  pendingConsentCount: number;
  displayEnabled: boolean;
  fontSize: MeetingCaptionFontSize;
  segments: readonly MeetingCaptionSegment[];
  operation: "idle" | "refreshing" | "requesting" | "consenting" | "stopping";
  error: string | null;
}>;
