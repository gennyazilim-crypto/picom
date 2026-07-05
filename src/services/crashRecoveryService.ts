import { diagnosticsService, type DiagnosticsSnapshot } from "./diagnosticsService";
import { loggingService, type LogEntry } from "./loggingService";

export type CrashRecoveryRecord = Readonly<{
  timestamp: string;
  errorName: string;
  userMessage: string;
  logId: string;
  diagnostics: DiagnosticsSnapshot;
  suspectedUncleanShutdown?: boolean;
}>;

const crashRecordKey = "picom:last-renderer-crash";
const crashPromptDismissedKey = "picom:crash-recovery:dismissed";
const runtimeStateKey = "picom:crash-recovery:runtime-state";

type RuntimeState = Readonly<{
  sessionId: string;
  status: "running" | "stable" | "clean_shutdown";
  updatedAt: string;
}>;

function readRecord(): CrashRecoveryRecord | null {
  try {
    const raw = localStorage.getItem(crashRecordKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CrashRecoveryRecord>;
    if (!parsed.timestamp || !parsed.errorName || !parsed.userMessage || !parsed.logId) {
      return null;
    }

    return {
      timestamp: parsed.timestamp,
      errorName: parsed.errorName,
      userMessage: parsed.userMessage,
      logId: parsed.logId,
      diagnostics: diagnosticsService.getSnapshot(),
      suspectedUncleanShutdown: Boolean(parsed.suspectedUncleanShutdown)
    };
  } catch {
    return null;
  }
}

function writeRecord(record: CrashRecoveryRecord): void {
  try {
    localStorage.setItem(crashRecordKey, JSON.stringify(record));
  } catch {
    loggingService.logWarn("Crash recovery record could not be persisted.", undefined, "crash-recovery");
  }
}

function getRecordPromptId(record: CrashRecoveryRecord): string {
  return `${record.timestamp}:${record.logId}`;
}

function readRuntimeState(): RuntimeState | null {
  try {
    const raw = localStorage.getItem(runtimeStateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeState>;
    if (!parsed.sessionId || !parsed.status || !parsed.updatedAt) return null;
    if (parsed.status !== "running" && parsed.status !== "stable" && parsed.status !== "clean_shutdown") return null;

    return {
      sessionId: parsed.sessionId,
      status: parsed.status,
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

function writeRuntimeState(status: RuntimeState["status"]): RuntimeState | null {
  try {
    const previous = readRuntimeState();
    const next: RuntimeState = {
      sessionId: previous?.sessionId && status !== "running" ? previous.sessionId : `runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(runtimeStateKey, JSON.stringify(next));
    return next;
  } catch {
    loggingService.logWarn("Crash recovery runtime state could not be persisted.", { status }, "crash-recovery");
    return null;
  }
}

export const crashRecoveryService = {
  recordStartupOpened(): CrashRecoveryRecord | null {
    const previousRuntime = readRuntimeState();
    writeRuntimeState("running");

    if (previousRuntime && previousRuntime.status !== "clean_shutdown" && !readRecord()) {
      const logEntry = loggingService.logWarn("Possible unclean desktop shutdown detected.", {
        previousRuntime: loggingService.redactDiagnosticsValue(previousRuntime)
      }, "crash-recovery");
      const record: CrashRecoveryRecord = {
        timestamp: new Date().toISOString(),
        errorName: "UncleanShutdownPlaceholder",
        userMessage: "Picom may not have closed cleanly last time. You can continue normally or start in Safe Mode.",
        logId: logEntry.id,
        diagnostics: diagnosticsService.getSnapshot(),
        suspectedUncleanShutdown: true
      };

      writeRecord(record);
      return record;
    }

    return readRecord();
  },

  recordStartupStable(): void {
    writeRuntimeState("stable");
  },

  recordCleanShutdown(): void {
    writeRuntimeState("clean_shutdown");
  },

  recordCrash(error: Error, logEntry: LogEntry): CrashRecoveryRecord {
    const record: CrashRecoveryRecord = {
      timestamp: new Date().toISOString(),
      errorName: error.name,
      userMessage: loggingService.formatUserError(error, "Picom could not finish starting."),
      logId: logEntry.id,
      diagnostics: diagnosticsService.getSnapshot()
    };

    writeRecord(record);
    try {
      localStorage.removeItem(crashPromptDismissedKey);
    } catch {
      loggingService.logWarn("Crash recovery prompt dismissal state could not be reset.", undefined, "crash-recovery");
    }

    return record;
  },

  getLastCrash(): CrashRecoveryRecord | null {
    return readRecord();
  },

  clearCrashState(): void {
    try {
      localStorage.removeItem(crashRecordKey);
      localStorage.removeItem(crashPromptDismissedKey);
    } catch {
      loggingService.logWarn("Crash recovery record could not be cleared.", undefined, "crash-recovery");
    }
  },

  shouldShowRecoveryDialog(): boolean {
    const record = readRecord();
    if (!record) return false;

    try {
      return localStorage.getItem(crashPromptDismissedKey) !== getRecordPromptId(record);
    } catch {
      return true;
    }
  },

  dismissRecoveryDialog(): void {
    const record = readRecord();
    if (!record) return;

    try {
      localStorage.setItem(crashPromptDismissedKey, getRecordPromptId(record));
    } catch {
      loggingService.logWarn("Crash recovery prompt dismissal could not be persisted.", undefined, "crash-recovery");
    }
  },

  getDiagnosticsText(): string {
    return JSON.stringify(
      {
        lastCrash: readRecord(),
        runtimeState: readRuntimeState(),
        diagnostics: diagnosticsService.getSnapshot(),
        recentLogs: loggingService.getRecentLogs(50)
      },
      null,
      2
    );
  },

  exportDiagnosticsFile(): { ok: true; message: string } {
    const content = this.getDiagnosticsText();
    const fileName = `picom-crash-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    if (typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return { ok: true, message: `Crash recovery diagnostics exported: ${fileName}.` };
    }

    return { ok: true, message: "Crash recovery diagnostics prepared. Native download is unavailable in this runtime." };
  },

  restartRenderer(): void {
    window.location.reload();
  }
};
