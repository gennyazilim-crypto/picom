import { loggingService } from "../loggingService";

const ENABLED_KEY = "picom.crashReporter.enabled.v1";
const RECORDS_KEY = "picom.crashReporter.localRecords.v1";
const MAX_LOCAL_RECORDS = 50;

export type CrashReportUserContext = "authenticated" | "anonymous";
export type CrashReportType = "exception" | "message";

export type CrashReportRecord = Readonly<{
  id: string;
  type: CrashReportType;
  timestamp: string;
  payload: unknown;
  userContext: CrashReportUserContext;
}>;

export type CrashReporterProvider = Readonly<{
  name: string;
  initialize?: () => void;
  capture: (record: CrashReportRecord) => void | Promise<void>;
  shutdown?: () => void | Promise<void>;
}>;

export type CrashReporterStatus = Readonly<{
  initialized: boolean;
  enabled: boolean;
  provider: string;
  providerConfigured: boolean;
  queuedLocalRecords: number;
  userContext: CrashReportUserContext;
}>;

let initialized = false;
let userContext: CrashReportUserContext = "anonymous";
let provider: CrashReporterProvider | null = null;

function isEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function readLocalRecords(): CrashReportRecord[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECORDS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.slice(-MAX_LOCAL_RECORDS) as CrashReportRecord[] : [];
  } catch {
    return [];
  }
}

function persistLocalRecord(record: CrashReportRecord): boolean {
  try {
    window.localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([...readLocalRecords(), record].slice(-MAX_LOCAL_RECORDS)),
    );
    return true;
  } catch (error) {
    loggingService.logWarn("Crash report could not be stored locally", { error }, "crash-reporter");
    return false;
  }
}

function sendToProvider(record: CrashReportRecord): void {
  if (!provider) {
    return;
  }

  try {
    const result = provider.capture(record);
    if (result && typeof result.catch === "function") {
      void result.catch((error: unknown) => {
        loggingService.logWarn("Crash report provider delivery failed", {
          provider: provider?.name ?? "unavailable",
          error,
        }, "crash-reporter");
      });
    }
  } catch (error) {
    loggingService.logWarn("Crash report provider rejected a report", {
      provider: provider.name,
      error,
    }, "crash-reporter");
  }
}

function createRecord(type: CrashReportType, payload: unknown): CrashReportRecord | null {
  if (!isEnabled()) {
    return null;
  }

  const record: CrashReportRecord = Object.freeze({
    id: `crash-report-${crypto.randomUUID()}`,
    type,
    timestamp: new Date().toISOString(),
    payload: loggingService.redactDiagnosticsValue(payload),
    userContext,
  });

  persistLocalRecord(record);
  sendToProvider(record);
  return record;
}

function initializeProvider(): void {
  if (!provider || !isEnabled()) {
    return;
  }

  try {
    provider.initialize?.();
  } catch (error) {
    loggingService.logWarn("Crash report provider initialization failed", {
      provider: provider.name,
      error,
    }, "crash-reporter");
  }
}

export const crashReporterService = {
  initialize(): CrashReporterStatus {
    initialized = true;
    initializeProvider();
    return this.getStatus();
  },

  configureProvider(nextProvider: CrashReporterProvider | null): CrashReporterStatus {
    provider = nextProvider;
    if (initialized) {
      initializeProvider();
    }
    return this.getStatus();
  },

  setEnabled(value: boolean): boolean {
    try {
      window.localStorage.setItem(ENABLED_KEY, String(value));
      if (!value) {
        window.localStorage.removeItem(RECORDS_KEY);
      } else if (!initialized) {
        this.initialize();
      } else {
        initializeProvider();
      }
    } catch {
      return false;
    }
    return value;
  },

  captureException(error: unknown, context?: unknown): CrashReportRecord | null {
    if (!initialized) {
      this.initialize();
    }
    const normalized = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
    return createRecord("exception", { error: normalized, context });
  },

  captureMessage(message: string, context?: unknown): CrashReportRecord | null {
    if (!initialized) {
      this.initialize();
    }
    return createRecord("message", { message: message.slice(0, 500), context });
  },

  setUserContext(_userId?: string): void {
    userContext = "authenticated";
  },

  clearUserContext(): void {
    userContext = "anonymous";
  },

  getStatus(): CrashReporterStatus {
    return Object.freeze({
      initialized,
      enabled: isEnabled(),
      provider: provider?.name ?? "local-only",
      providerConfigured: provider !== null,
      queuedLocalRecords: readLocalRecords().length,
      userContext,
    });
  },
};

