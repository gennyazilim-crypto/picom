import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export type DeviceQuietHoursV1 = Readonly<{
  enabled: boolean;
  startTime: string;
  endTime: string;
  applyTo: "all_notifications" | "normal_messages_only" | "sounds_only";
  allowMentions: boolean;
}>;

export type DeviceLocalSettingsV1 = Readonly<{
  schemaVersion: 2;
  selectedMicrophoneId: string | null;
  selectedSpeakerId: string | null;
  selectedCameraId: string | null;
  inputVolume: number;
  outputVolume: number;
  closeToTray: boolean;
  /** Canonical Task 08 behavior fields. Legacy aliases above remain for compatibility. */
  startupVisibility: "normal" | "tray";
  closeBehavior: "tray" | "quit";
  startupDestination: "last" | "feed" | "messages" | "communities";
  lastSafeLocation: "feed" | "messages" | "communities" | null;
  rememberWindowBounds: boolean;
  launchMinimized: boolean;
  nativeDesktopEnabled: boolean;
  soundEnabled: boolean;
  notifyWhileFocused: boolean;
  taskbarFlash: boolean;
  trayBadge: boolean;
  titlebarBadge: boolean;
  quietHours: DeviceQuietHoursV1;
}>;

const DEFAULT_QUIET_HOURS: DeviceQuietHoursV1 = Object.freeze({
  enabled: false,
  startTime: "22:00",
  endTime: "07:00",
  applyTo: "normal_messages_only",
  allowMentions: true,
});

const DEFAULTS: DeviceLocalSettingsV1 = Object.freeze({
  schemaVersion: 2,
  selectedMicrophoneId: null,
  selectedSpeakerId: null,
  selectedCameraId: null,
  inputVolume: 1,
  outputVolume: 1,
  closeToTray: true,
  startupVisibility: "normal",
  closeBehavior: "tray",
  startupDestination: "last",
  lastSafeLocation: null,
  rememberWindowBounds: true,
  launchMinimized: false,
  nativeDesktopEnabled: true,
  soundEnabled: true,
  notifyWhileFocused: true,
  taskbarFlash: true,
  trayBadge: true,
  titlebarBadge: true,
  quietHours: DEFAULT_QUIET_HOURS,
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "device-local-settings.v1.json");
}

function normalizeQuietHours(raw: unknown): DeviceQuietHoursV1 {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_QUIET_HOURS };
  const record = raw as Record<string, unknown>;
  const applyTo = record.applyTo === "all_notifications" || record.applyTo === "sounds_only"
    ? record.applyTo
    : "normal_messages_only";
  return {
    enabled: record.enabled === true,
    startTime: typeof record.startTime === "string" ? record.startTime : DEFAULT_QUIET_HOURS.startTime,
    endTime: typeof record.endTime === "string" ? record.endTime : DEFAULT_QUIET_HOURS.endTime,
    applyTo,
    allowMentions: record.allowMentions !== false,
  };
}

function normalize(raw: unknown): DeviceLocalSettingsV1 {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULTS, quietHours: { ...DEFAULT_QUIET_HOURS } };
  const record = raw as Record<string, unknown>;
  return {
    schemaVersion: 2,
    selectedMicrophoneId: typeof record.selectedMicrophoneId === "string" ? record.selectedMicrophoneId : null,
    selectedSpeakerId: typeof record.selectedSpeakerId === "string" ? record.selectedSpeakerId : null,
    selectedCameraId: typeof record.selectedCameraId === "string" ? record.selectedCameraId : null,
    inputVolume: clamp01(typeof record.inputVolume === "number" ? record.inputVolume : 1),
    outputVolume: clamp01(typeof record.outputVolume === "number" ? record.outputVolume : 1),
    // Legacy booleans are retained as aliases while this version is persisted.
    closeToTray: record.closeBehavior === "quit" ? false : record.closeBehavior === "tray" ? true : record.closeToTray !== false,
    startupVisibility: record.startupVisibility === "tray" || (record.startupVisibility !== "normal" && record.launchMinimized === true)
      ? "tray"
      : "normal",
    closeBehavior: record.closeBehavior === "quit" || (record.closeBehavior !== "tray" && record.closeToTray === false)
      ? "quit"
      : "tray",
    startupDestination: record.startupDestination === "feed" || record.startupDestination === "messages" || record.startupDestination === "communities"
      ? record.startupDestination
      : "last",
    lastSafeLocation: record.lastSafeLocation === "feed" || record.lastSafeLocation === "messages" || record.lastSafeLocation === "communities"
      ? record.lastSafeLocation
      : null,
    rememberWindowBounds: record.rememberWindowBounds !== false,
    launchMinimized: record.startupVisibility === "tray" ? true : record.startupVisibility === "normal" ? false : record.launchMinimized === true,
    nativeDesktopEnabled: record.nativeDesktopEnabled !== false,
    soundEnabled: record.soundEnabled !== false,
    notifyWhileFocused: record.notifyWhileFocused !== false,
    taskbarFlash: record.taskbarFlash !== false,
    trayBadge: record.trayBadge !== false,
    titlebarBadge: record.titlebarBadge !== false,
    quietHours: normalizeQuietHours(record.quietHours),
  };
}

export function readDeviceLocalSettings(): DeviceLocalSettingsV1 {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return normalize(parsed);
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeDeviceLocalSettings(partial: Partial<Omit<DeviceLocalSettingsV1, "schemaVersion">>): DeviceLocalSettingsV1 {
  const next = normalize({ ...readDeviceLocalSettings(), ...partial, schemaVersion: 2 });
  try {
    fs.writeFileSync(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch {
    // Best-effort persistence; in-memory return still reflects requested values.
  }
  return next;
}

export function resetDeviceLocalSettings(): DeviceLocalSettingsV1 {
  try {
    fs.writeFileSync(settingsPath(), `${JSON.stringify(DEFAULTS, null, 2)}\n`, "utf8");
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export type CacheUsageSnapshot = Readonly<{
  userDataBytes: number;
  cacheBytes: number;
  logsBytes: number;
  tempBytes: number;
}>;

function directoryBytes(dir: string, depth = 0): number {
  if (depth > 8) return 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += directoryBytes(full, depth + 1);
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* ignore */
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export function measureCacheUsage(): CacheUsageSnapshot {
  const userData = app.getPath("userData");
  // Electron path names vary by version; Cache under userData is the portable SoT.
  const cache = path.join(userData, "Cache");
  const logs = path.join(userData, "logs");
  const temp = app.getPath("temp");
  return {
    userDataBytes: directoryBytes(userData),
    cacheBytes: directoryBytes(cache),
    logsBytes: directoryBytes(logs),
    tempBytes: directoryBytes(temp),
  };
}

export type SafeOpenTarget = "logs" | "downloads" | "userData";

export function resolveSafeOpenPath(target: SafeOpenTarget): string {
  if (target === "downloads") return app.getPath("downloads");
  if (target === "logs") {
    const logs = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logs, { recursive: true });
    return logs;
  }
  return app.getPath("userData");
}
