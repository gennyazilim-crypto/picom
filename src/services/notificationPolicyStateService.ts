export type NotificationPolicyState = Readonly<{
  doNotDisturb: boolean;
  mutedCommunityIds: string[];
  mutedChannelIds: string[];
}>;

const STORAGE_KEY = "picom.notificationPolicyState.v1";
const defaults: NotificationPolicyState = { doNotDisturb: false, mutedCommunityIds: [], mutedChannelIds: [] };
type NotificationPolicyListener = (state: NotificationPolicyState) => void;
const listeners = new Set<NotificationPolicyListener>();

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 500) : [];
}

function read(): NotificationPolicyState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<NotificationPolicyState>;
    return {
      doNotDisturb: parsed.doNotDisturb === true,
      mutedCommunityIds: normalizeIds(parsed.mutedCommunityIds),
      mutedChannelIds: normalizeIds(parsed.mutedChannelIds),
    };
  } catch {
    return defaults;
  }
}

function write(next: NotificationPolicyState): NotificationPolicyState {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* restricted desktop fallback */ }
  listeners.forEach((listener) => listener(next));
  return next;
}

function toggleId(ids: string[], id: string, muted: boolean): string[] {
  return muted ? [...new Set([...ids, id])].slice(0, 500) : ids.filter((candidate) => candidate !== id);
}

export const notificationPolicyStateService = {
  getSnapshot: read,
  setDoNotDisturb(enabled: boolean): NotificationPolicyState {
    return write({ ...read(), doNotDisturb: enabled });
  },
  setCommunityMuted(communityId: string, muted: boolean): NotificationPolicyState {
    const current = read();
    return write({ ...current, mutedCommunityIds: toggleId(current.mutedCommunityIds, communityId, muted) });
  },
  setChannelMuted(channelId: string, muted: boolean): NotificationPolicyState {
    const current = read();
    return write({ ...current, mutedChannelIds: toggleId(current.mutedChannelIds, channelId, muted) });
  },
  isCommunityMuted(communityId?: string | null): boolean {
    return Boolean(communityId && read().mutedCommunityIds.includes(communityId));
  },
  isChannelMuted(channelId?: string | null): boolean {
    return Boolean(channelId && read().mutedChannelIds.includes(channelId));
  },
  subscribe(listener: NotificationPolicyListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
