import { diagnosticsService } from "./diagnosticsService";
import { fileService } from "./fileService";
import { loggingService, type LogEntry } from "./loggingService";
import { clipboardService } from "./clipboardService";
import type { MeetingDiagnosticsSummary } from "./meetingDiagnosticsRegistry";

export type FeedbackIssueType =
  | "install_package"
  | "startup_crash"
  | "login_auth"
  | "community_channel"
  | "messaging"
  | "upload"
  | "mention_feed"
  | "profile_page"
  | "permissions_rls"
  | "voice"
  | "screen_share"
  | "performance"
  | "ui_layout"
  | "accessibility"
  | "security_privacy"
  | "legal_policy"
  | "other"
  | "crash"
  | "realtime"
  | "packaging_install"
  | "security_concern"
  | "bug"
  | "login"
  | "message"
  | "packaging";

export type FeedbackSeverity = "blocker" | "critical" | "major" | "minor" | "suggestion";

export type FeedbackDraft = Readonly<{
  issueType: FeedbackIssueType;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  screenshotReference?: string;
  includeDiagnostics: boolean;
  includeLogs: boolean;
}>;

export type SupportDiagnosticsPayload = Readonly<{
  createdAt: string;
  app: {
    name: string;
    identifier: string;
    version: string;
    environment: string;
    releaseChannel: string;
    dataSource: string;
    runtimeTarget: string;
  };
  runtime: {
    userAgent: string;
    platform: string;
    electronVersion: string | null;
    language: string;
    online: boolean;
    window: {
      width: number | null;
      height: number | null;
      focused: boolean;
    };
  };
  serviceStatus: {
    realtimeStatus: string;
    supabaseStatus: string;
    supabaseHost: string | null;
    liveKitStatus: string;
    meeting: MeetingDiagnosticsSummary;
    authState: "authenticated" | "signed_out";
    activeView: string;
    activeCommunityId: string | null;
    activeChannelId: string | null;
    lastApiError: null | {
      id: string;
      timestamp: string;
      message: string;
      source?: string;
    };
  };
  recentErrors: Array<{ id: string; timestamp: string; message: string; source?: string }>;
  environments: {
    supabase: string;
    liveKit: string;
  };
  feedback?: FeedbackDraft;
  recentLogs: LogEntry[];
  note: string;
}>;

export type SupportLogExportResult =
  | Readonly<{ ok: true; method: "native" | "browser"; canceled?: boolean }>
  | Readonly<{ ok: false; reason: string }>;

function createFileSafeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function browserDownload(defaultPath: string, content: string): SupportLogExportResult {
  if (typeof document === "undefined") {
    return { ok: false, reason: "Browser download fallback is unavailable in this runtime." };
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultPath;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);

  return { ok: true, method: "browser" };
}

function redactFeedbackDraft(feedback?: FeedbackDraft): FeedbackDraft | undefined {
  return feedback ? loggingService.redactDiagnosticsValue(feedback) : undefined;
}

export const feedbackService = {
  createDiagnosticsPayload(feedback?: FeedbackDraft): SupportDiagnosticsPayload {
    const diagnostics = diagnosticsService.getSnapshot();
    const redactedFeedback = redactFeedbackDraft(feedback);

    return loggingService.redactDiagnosticsValue({
      createdAt: new Date().toISOString(),
      app: diagnostics.app,
      runtime: diagnostics.runtime,
      serviceStatus: diagnostics.serviceStatus,
      recentErrors: diagnostics.recentErrors,
      environments: {
        supabase: diagnostics.serviceStatus.supabaseHost
          ? `${diagnostics.app.environment}:${diagnostics.serviceStatus.supabaseHost}`
          : `${diagnostics.app.environment}:not_configured`,
        liveKit: `${diagnostics.app.environment}:${diagnostics.serviceStatus.liveKitStatus}`
      },
      feedback: redactedFeedback,
      recentLogs: feedback?.includeLogs ? loggingService.getRecentLogs(75) : [],
      note: "Picom support diagnostics are included only after explicit user action and are redacted by loggingService. Meeting evidence is aggregate-only and must not include room/session identities, media, captions, chat content, passwords, tokens, cookies, authorization headers, privileged server keys, or private secrets."
    });
  },

  createReportText(feedback: FeedbackDraft): string {
    const payload = feedback.includeDiagnostics
      ? this.createDiagnosticsPayload(feedback)
      : loggingService.redactDiagnosticsValue({ createdAt: new Date().toISOString(), feedback, recentLogs: feedback.includeLogs ? loggingService.getRecentLogs(75) : [] });
    return JSON.stringify(payload, null, 2);
  },

  async copyReport(feedback: FeedbackDraft): Promise<{ ok: true } | { ok: false; reason: string }> {
    return clipboardService.copyText(this.createReportText(feedback));
  },

  async exportSupportDiagnostics(feedback?: FeedbackDraft): Promise<SupportLogExportResult> {
    const defaultPath = `picom-support-diagnostics-${createFileSafeTimestamp()}.json`;
    const content = JSON.stringify(this.createDiagnosticsPayload(feedback), null, 2);
    const nativeResult = await fileService.saveText(defaultPath, content);

    if (nativeResult.ok) {
      return { ok: true, method: "native", canceled: nativeResult.canceled };
    }

    return browserDownload(defaultPath, content);
  }
};
