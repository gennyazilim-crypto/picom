import { loggingService, type LogEntry } from "./loggingService";

export type CrashRecoveryRecord = Readonly<{
  timestamp: string;
  errorName: string;
  userMessage: string;
  logId: string;
}>;

const crashRecordKey = "picom:last-renderer-crash";

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
      logId: parsed.logId
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

export const crashRecoveryService = {
  recordCrash(error: Error, logEntry: LogEntry): CrashRecoveryRecord {
    const record: CrashRecoveryRecord = {
      timestamp: new Date().toISOString(),
      errorName: error.name,
      userMessage: loggingService.formatUserError(error, "Picom could not finish starting."),
      logId: logEntry.id
    };

    writeRecord(record);
    return record;
  },

  getLastCrash(): CrashRecoveryRecord | null {
    return readRecord();
  },

  clearCrashState(): void {
    try {
      localStorage.removeItem(crashRecordKey);
    } catch {
      loggingService.logWarn("Crash recovery record could not be cleared.", undefined, "crash-recovery");
    }
  },

  getDiagnosticsText(): string {
    return JSON.stringify(
      {
        lastCrash: readRecord(),
        recentLogs: loggingService.getRecentLogs(50)
      },
      null,
      2
    );
  },

  restartRenderer(): void {
    window.location.reload();
  }
};
