import { cacheManagementService } from "./cacheManagementService";
import { loggingService } from "./loggingService";
import { settingsService } from "./settingsService";

export type SafeModeReason =
  | "manual_flag"
  | "query_flag"
  | "repeated_startup_crash"
  | "corrupted_settings_placeholder"
  | "local_data_migration_failed";

export type SafeModeState = Readonly<{
  active: boolean;
  reason: SafeModeReason | null;
  crashCount: number;
  disabledServices: string[];
}>;

export type SafeModeActionResult = Readonly<{
  ok: true;
  message: string;
}>;

const forcedSafeModeKey = "picom:safe-mode:forced";
const forcedSafeModeReasonKey = "picom:safe-mode:reason";
const startupCrashCountKey = "picom:safe-mode:startup-crash-count";
const startupCrashThreshold = 2;
let runtimeForcedReason: SafeModeReason | null = null;

const disabledServices = [
  "Realtime paused",
  "Tray paused",
  "Notifications paused",
  "Updates paused",
  "Remote config skipped",
  "Voice paused",
  "Custom themes disabled",
  "Heavy diagnostics paused",
];

function readCrashCount(): number {
  try {
    const value = Number(localStorage.getItem(startupCrashCountKey) ?? "0");
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeCrashCount(nextCount: number): void {
  try {
    localStorage.setItem(startupCrashCountKey, String(Math.max(0, nextCount)));
  } catch {
    loggingService.logWarn("Safe Mode crash count could not be persisted.", undefined, "safe-mode");
  }
}

function hasQueryFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("safeMode");
}

function hasForcedFlag(): boolean {
  try {
    return localStorage.getItem(forcedSafeModeKey) === "true";
  } catch {
    return false;
  }
}

function readForcedReason(): SafeModeReason {
  try {
    const reason = localStorage.getItem(forcedSafeModeReasonKey);
    if (
      reason === "manual_flag" ||
      reason === "query_flag" ||
      reason === "repeated_startup_crash" ||
      reason === "corrupted_settings_placeholder" ||
      reason === "local_data_migration_failed"
    ) {
      return reason;
    }
  } catch {
    return "manual_flag";
  }

  return "manual_flag";
}

export const safeModeService = {
  getStartupState(): SafeModeState {
    const crashCount = readCrashCount();
    const queryFlag = hasQueryFlag();
    const forcedFlag = Boolean(runtimeForcedReason) || hasForcedFlag();
    const active = queryFlag || forcedFlag || crashCount >= startupCrashThreshold;
    const reason: SafeModeReason | null = queryFlag
      ? "query_flag"
      : forcedFlag
        ? runtimeForcedReason ?? readForcedReason()
        : crashCount >= startupCrashThreshold
          ? "repeated_startup_crash"
          : null;

    return {
      active,
      reason,
      crashCount,
      disabledServices: active ? disabledServices : [],
    };
  },

  recordStartupCrash(): SafeModeState {
    writeCrashCount(readCrashCount() + 1);
    return this.getStartupState();
  },

  recordStartupStable(): SafeModeState {
    writeCrashCount(0);
    return this.getStartupState();
  },

  enableSafeMode(reason: SafeModeReason = "manual_flag"): SafeModeState {
    runtimeForcedReason = reason;
    try {
      localStorage.setItem(forcedSafeModeKey, "true");
      localStorage.setItem(forcedSafeModeReasonKey, reason);
    } catch {
      loggingService.logWarn("Safe Mode flag could not be persisted.", { reason }, "safe-mode");
    }

    return this.getStartupState();
  },

  exitSafeMode(): SafeModeActionResult {
    runtimeForcedReason = null;
    try {
      localStorage.removeItem(forcedSafeModeKey);
      localStorage.removeItem(forcedSafeModeReasonKey);
      localStorage.removeItem(startupCrashCountKey);
    } catch {
      loggingService.logWarn("Safe Mode flags could not be cleared.", undefined, "safe-mode");
    }

    return { ok: true, message: "Safe Mode disabled. Restart Picom normally to restore optional services." };
  },

  async resetSettings(): Promise<SafeModeActionResult> {
    settingsService.resetSettings();
    return { ok: true, message: "Local settings reset to safe defaults. Auth session was preserved." };
  },

  async clearCache(): Promise<SafeModeActionResult> {
    const result = await cacheManagementService.clearAllNonEssentialCache();
    return { ok: true, message: result.message };
  },

  exportLogs(): SafeModeActionResult {
    const content = loggingService.exportLogs();
    const fileName = `picom-safe-mode-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    if (typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return { ok: true, message: `Safe Mode logs exported: ${fileName}.` };
    }

    return { ok: true, message: "Safe Mode logs prepared. Native download is unavailable in this runtime." };
  },

  restartNormally(): void {
    this.exitSafeMode();
    try {
      localStorage.setItem("picom:safe-mode:last-normal-restart", new Date().toISOString());
    } catch {
      // Runtime state is already cleared in memory; storage is best-effort.
    }
    window.location.reload();
  },
};
