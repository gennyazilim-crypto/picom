import { loggingService } from "./loggingService";
const ENABLED_KEY = "picom.crashReporter.enabled.v1"; const RECORDS_KEY = "picom.crashReporter.localRecords.v1";
type CrashRecord = Readonly<{ id: string; type: "exception" | "message"; timestamp: string; payload: unknown; userContext: "authenticated" | "anonymous" }>;
let initialized = false; let userContext: CrashRecord["userContext"] = "anonymous";
function enabled(): boolean { try { return window.localStorage.getItem(ENABLED_KEY) === "true"; } catch { return false; } }
function read(): CrashRecord[] { try { const parsed = JSON.parse(window.localStorage.getItem(RECORDS_KEY) ?? "[]") as CrashRecord[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function store(type: CrashRecord["type"], payload: unknown): CrashRecord | null { if (!enabled()) return null; const record: CrashRecord = { id: `crash-report-${crypto.randomUUID()}`, type, timestamp: new Date().toISOString(), payload: loggingService.redactDiagnosticsValue(payload), userContext }; try { window.localStorage.setItem(RECORDS_KEY, JSON.stringify([...read(), record].slice(-50))); } catch { return null; } return record; }
export const crashReporterService = {
  initialize(): { initialized: true; enabled: boolean; provider: "disabled" } { initialized = true; return { initialized: true, enabled: enabled(), provider: "disabled" }; },
  setEnabled(value: boolean): boolean { try { window.localStorage.setItem(ENABLED_KEY, String(value)); if (!value) window.localStorage.removeItem(RECORDS_KEY); } catch { return false; } return value; },
  captureException(error: unknown, context?: unknown): CrashRecord | null { if (!initialized) this.initialize(); const normalized = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }; return store("exception", { error: normalized, context }); },
  captureMessage(message: string, context?: unknown): CrashRecord | null { if (!initialized) this.initialize(); return store("message", { message: message.slice(0, 500), context }); },
  setUserContext(_userId?: string): void { userContext = "authenticated"; },
  clearUserContext(): void { userContext = "anonymous"; },
  getStatus() { return { initialized, enabled: enabled(), provider: "disabled" as const, queuedLocalRecords: read().length, userContext }; },
};
