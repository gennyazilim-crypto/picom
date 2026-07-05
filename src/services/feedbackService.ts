import { diagnosticsService } from "./diagnosticsService";
import { fileService } from "./fileService";
import { loggingService, type LogEntry } from "./loggingService";

export type FeedbackIssueType = "bug" | "crash" | "login" | "message" | "upload" | "voice" | "packaging" | "other";

export type FeedbackDraft = Readonly<{
  issueType: FeedbackIssueType;
  title: string;
  description: string;
  includeDiagnostics: boolean;
  includeLogs: boolean;
}>;

export type FeedbackPlaceholderResult = Readonly<{
  ok: true;
  referenceId: string;
  message: string;
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
    language: string;
    online: boolean;
  };
  serviceStatus: {
    realtimeStatus: string;
    lastApiError: null | {
      id: string;
      timestamp: string;
      message: string;
      source?: string;
    };
  };
  feedback?: FeedbackDraft;
  recentLogs: LogEntry[];
  note: string;
}>;

export type SupportLogExportResult =
  | Readonly<{ ok: true; method: "native" | "browser"; canceled?: boolean }>
  | Readonly<{ ok: false; reason: string }>;

function createReferenceId(): string {
  return `feedback-${Date.now().toString(36)}`;
}

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

    return {
      createdAt: new Date().toISOString(),
      app: diagnostics.app,
      runtime: diagnostics.runtime,
      serviceStatus: diagnostics.serviceStatus,
      feedback: redactedFeedback,
      recentLogs: feedback?.includeLogs ? loggingService.getRecentLogs(75) : [],
      note: "Picom beta diagnostics placeholder. Payload is redacted by loggingService and must not include passwords, tokens, cookies, authorization headers, service-role keys, or private secrets."
    };
  },

  submitPlaceholder(feedback: FeedbackDraft): FeedbackPlaceholderResult {
    const referenceId = createReferenceId();
    const diagnostics = feedback.includeDiagnostics ? this.createDiagnosticsPayload(feedback) : undefined;

    loggingService.logInfo("Feedback placeholder captured locally.", {
      referenceId,
      issueType: feedback.issueType,
      title: feedback.title,
      includeDiagnostics: feedback.includeDiagnostics,
      includeLogs: feedback.includeLogs,
      diagnosticsSummary: diagnostics
        ? {
            environment: diagnostics.app.environment,
            releaseChannel: diagnostics.app.releaseChannel,
            dataSource: diagnostics.app.dataSource,
            logCount: diagnostics.recentLogs.length
          }
        : undefined
    }, "feedback");

    return {
      ok: true,
      referenceId,
      message: "Feedback placeholder saved locally. No report was sent yet."
    };
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
