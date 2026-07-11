import type { MeetingTransportConnectionState } from "../types/meeting";
import type { VoiceConnectionQuality, VoiceDurationBucket } from "../utils/voiceQualityMetrics";

export type VoiceSessionDiagnosticsSummary = Readonly<{
  status: MeetingTransportConnectionState;
  connected: boolean;
  participantCount: number;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  remoteScreenShareCount: number;
  lastErrorCode: string | null;
  connectionQuality: VoiceConnectionQuality;
  reconnectCount: number;
  joinAttemptCount: number;
  joinFailureCount: number;
  deviceErrorCount: number;
  sessionDurationBucket: VoiceDurationBucket;
}>;

const idleSummary: VoiceSessionDiagnosticsSummary = {
  status: "idle",
  connected: false,
  participantCount: 0,
  muted: false,
  deafened: false,
  screenSharing: false,
  remoteScreenShareCount: 0,
  lastErrorCode: null,
  connectionQuality: "unknown",
  reconnectCount: 0,
  joinAttemptCount: 0,
  joinFailureCount: 0,
  deviceErrorCount: 0,
  sessionDurationBucket: "none",
};

let provider: (() => VoiceSessionDiagnosticsSummary) | null = null;

export const voiceDiagnosticsRegistry = {
  setProvider(nextProvider: () => VoiceSessionDiagnosticsSummary): void { provider = nextProvider; },
  getSummary(): VoiceSessionDiagnosticsSummary { return provider?.() ?? idleSummary; },
};
