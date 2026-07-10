import type { UserStatus } from "../types/community";

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_STALE_AFTER_MS = 90_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60_000;

export type PresencePayload = Readonly<{
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastSeen: string;
}>;

function isPresencePayload(value: unknown): value is PresencePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PresencePayload>;
  return typeof payload.userId === "string"
    && payload.userId.length > 0
    && typeof payload.displayName === "string"
    && (payload.avatarUrl === null || typeof payload.avatarUrl === "string" || typeof payload.avatarUrl === "undefined")
    && ["online", "idle", "dnd", "offline"].includes(String(payload.status))
    && typeof payload.lastSeen === "string";
}

export function isFreshPresence(lastSeen: string, nowMs = Date.now()): boolean {
  const timestamp = Date.parse(lastSeen);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp <= nowMs + MAX_FUTURE_CLOCK_SKEW_MS && nowMs - timestamp <= PRESENCE_STALE_AFTER_MS;
}

export function aggregatePresenceEntries(entries: readonly unknown[], nowMs = Date.now()): Record<string, PresencePayload> {
  const result: Record<string, PresencePayload> = {};

  for (const entry of entries) {
    if (!isPresencePayload(entry) || entry.status === "offline" || !isFreshPresence(entry.lastSeen, nowMs)) continue;
    const current = result[entry.userId];
    if (current && Date.parse(current.lastSeen) >= Date.parse(entry.lastSeen)) continue;
    result[entry.userId] = {
      userId: entry.userId,
      displayName: entry.displayName.slice(0, 80),
      avatarUrl: entry.avatarUrl?.slice(0, 2048) ?? null,
      status: entry.status,
      lastSeen: entry.lastSeen,
    };
  }

  return result;
}

export function prunePresenceMap(entries: Record<string, PresencePayload>, nowMs = Date.now()): Record<string, PresencePayload> {
  return aggregatePresenceEntries(Object.values(entries), nowMs);
}
