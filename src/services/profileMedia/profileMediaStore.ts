import type { ProfileMediaRecord, ProfileMediaSnapshot } from "./profileMediaTypes";

const EMPTY_SNAPSHOT: ProfileMediaSnapshot = Object.freeze({ state: "idle", record: null, error: null });
const snapshots = new Map<string, ProfileMediaSnapshot>();
const listeners = new Map<string, Set<() => void>>();

function emit(userId: string): void {
  listeners.get(userId)?.forEach((listener) => listener());
}

function isStale(current: ProfileMediaRecord | null, incoming: ProfileMediaRecord): boolean {
  if (!current) return false;
  if (incoming.avatar.version < current.avatar.version || incoming.cover.version < current.cover.version) return true;
  const currentTime = current.updatedAt ? Date.parse(current.updatedAt) : 0;
  const incomingTime = incoming.updatedAt ? Date.parse(incoming.updatedAt) : 0;
  return incoming.avatar.version === current.avatar.version
    && incoming.cover.version === current.cover.version
    && incomingTime > 0
    && currentTime > incomingTime;
}

export const profileMediaStore = {
  subscribe(userId: string, listener: () => void): () => void {
    const userListeners = listeners.get(userId) ?? new Set<() => void>();
    userListeners.add(listener);
    listeners.set(userId, userListeners);
    return () => {
      userListeners.delete(listener);
      if (!userListeners.size) listeners.delete(userId);
    };
  },
  getSnapshot(userId?: string | null): ProfileMediaSnapshot {
    return userId ? snapshots.get(userId) ?? EMPTY_SNAPSHOT : EMPTY_SNAPSHOT;
  },
  markLoading(userId: string): void {
    const current = snapshots.get(userId) ?? EMPTY_SNAPSHOT;
    if (current.state === "loading") return;
    snapshots.set(userId, { state: "loading", record: current.record, error: null });
    emit(userId);
  },
  setReady(record: ProfileMediaRecord): boolean {
    const current = snapshots.get(record.userId)?.record ?? null;
    if (isStale(current, record)) return false;
    snapshots.set(record.userId, { state: "ready", record, error: null });
    emit(record.userId);
    return true;
  },
  markError(userId: string, error: string): void {
    const current = snapshots.get(userId) ?? EMPTY_SNAPSHOT;
    snapshots.set(userId, { state: "error", record: current.record, error });
    emit(userId);
  },
  invalidate(userId: string): void {
    const current = snapshots.get(userId);
    if (!current?.record) return;
    snapshots.set(userId, {
      state: "idle",
      error: null,
      record: {
        ...current.record,
        signedUrlExpiresAt: null,
        avatar: { ...current.record.avatar, url: null, thumbnailUrl: null },
        cover: { ...current.record.cover, url: null, thumbnailUrl: null },
      },
    });
    emit(userId);
  },
  remove(userId: string): void {
    snapshots.delete(userId);
    emit(userId);
  },
  trackedUserIds(): string[] {
    return Array.from(new Set([...snapshots.keys(), ...listeners.keys()]));
  },
};
