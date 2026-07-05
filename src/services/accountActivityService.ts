import { loggingService } from "./loggingService";
import { platformService } from "./platformService";

export type AccountActivityType =
  | "login_success"
  | "login_failed_placeholder"
  | "logout"
  | "password_changed"
  | "email_changed_placeholder"
  | "session_revoked"
  | "profile_updated"
  | "account_deletion_requested";

export type AccountActivityRecord = Readonly<{
  id: string;
  type: AccountActivityType;
  userId: string | null;
  timestamp: string;
  device: string;
  platform: string;
  locationPlaceholder: string;
  ipAddressStored: false;
  metadata?: Record<string, string | number | boolean | null>;
}>;

export type CreateAccountActivityInput = Readonly<{
  type: AccountActivityType;
  userId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}>;

const STORAGE_KEY = "picom.accountActivity.v1";
const MAX_RECORDS = 50;
let activityCounter = 0;

function createActivityId(): string {
  activityCounter += 1;
  return `account-activity-${Date.now()}-${activityCounter}`;
}

function readRecords(): AccountActivityRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { records?: AccountActivityRecord[] };
    return Array.isArray(parsed.records) ? parsed.records.slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: AccountActivityRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ records: records.slice(0, MAX_RECORDS) }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function getActivityTitle(type: AccountActivityType): string {
  const labels: Record<AccountActivityType, string> = {
    login_success: "Login successful",
    login_failed_placeholder: "Login failed placeholder",
    logout: "Logged out",
    password_changed: "Password changed",
    email_changed_placeholder: "Email changed placeholder",
    session_revoked: "Session revoked",
    profile_updated: "Profile updated",
    account_deletion_requested: "Account deletion requested",
  };

  return labels[type];
}

export const accountActivityService = {
  recordActivity(input: CreateAccountActivityInput): AccountActivityRecord {
    const platform = platformService.getInfo();
    const record: AccountActivityRecord = {
      id: createActivityId(),
      type: input.type,
      userId: input.userId ?? null,
      timestamp: new Date().toISOString(),
      device: `${platform.platformLabel} ${platform.runtimeLabel}`,
      platform: platform.platformLabel,
      locationPlaceholder: "Location unavailable",
      ipAddressStored: false,
      metadata: input.metadata ? loggingService.redactDiagnosticsValue(input.metadata) : undefined,
    };

    writeRecords([record, ...readRecords()]);

    loggingService.logInfo("Account activity recorded", {
      activityId: record.id,
      type: record.type,
      userId: record.userId,
      platform: record.platform,
      ipAddressStored: false
    }, "account-activity");

    return record;
  },

  listRecent(limit = 12): AccountActivityRecord[] {
    return readRecords().slice(0, limit);
  },

  getActivityTitle,

  clearLocalActivity(): void {
    writeRecords([]);
  }
};
