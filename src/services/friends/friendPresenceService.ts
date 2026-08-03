import type { UserStatus } from "../../types/community";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { realtimeChannelNames } from "../supabase/realtimeService";

export type FriendPresence = Readonly<{ status: UserStatus; statusText: string }>;
export type FriendPresenceSnapshot = Readonly<Record<string, FriendPresence>>;

type PresenceSubscriptionKey = "friend-presence" | "dm-presence";
type PresenceRpcName = "list_friend_presence" | "list_direct_conversation_presence";
type ActivePresenceSubscription = Readonly<{ cancel: () => void }>;
const activePresenceSubscriptions = new Map<PresenceSubscriptionKey, ActivePresenceSubscription>();
let presenceRealtimeSubscriptionSequence = 0;

function uniquePresenceChannelName(baseName: string): string {
  presenceRealtimeSubscriptionSequence += 1;
  return `${baseName}:subscription-${presenceRealtimeSubscriptionSequence}`;
}

function safePresence(status: unknown): FriendPresence {
  if (status === "online") return { status: "online", statusText: "Online" };
  if (status === "idle") return { status: "idle", statusText: "Idle" };
  if (status === "dnd" || status === "busy") return { status: "dnd", statusText: "Busy" };
  return { status: "offline", statusText: "Offline" };
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

async function subscribeWithRpc(
  subscriptionKey: PresenceSubscriptionKey,
  userIds: string[],
  rpcName: PresenceRpcName,
  listener: (snapshot: FriendPresenceSnapshot) => void,
): Promise<() => void> {
  const normalizedIds = [...new Set(userIds.filter(Boolean))].slice(0, 100);
  let active = true;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingOfflineTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let periodicRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let removeLifecycleListeners: (() => void) | undefined;
  let removeRealtimeChannel: (() => void) | undefined;
  let record: ActivePresenceSubscription;
  const cancel = () => {
    if (!active) return;
    active = false;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (pendingOfflineTimer) clearTimeout(pendingOfflineTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (periodicRefreshTimer) clearInterval(periodicRefreshTimer);
    removeLifecycleListeners?.();
    removeRealtimeChannel?.();
    if (activePresenceSubscriptions.get(subscriptionKey) === record) activePresenceSubscriptions.delete(subscriptionKey);
  };
  record = { cancel };
  activePresenceSubscriptions.get(subscriptionKey)?.cancel();
  activePresenceSubscriptions.set(subscriptionKey, record);

  const emit = (snapshot: FriendPresenceSnapshot) => {
    if (!active || activePresenceSubscriptions.get(subscriptionKey) !== record) return;
    if (pendingOfflineTimer) clearTimeout(pendingOfflineTimer);
    listener(snapshot);
  };
  const scheduleOffline = () => {
    if (pendingOfflineTimer) clearTimeout(pendingOfflineTimer);
    pendingOfflineTimer = setTimeout(() => emit(Object.fromEntries(normalizedIds.map((userId) => [userId, safePresence("offline")]))), 250);
  };


  const auth = await authenticatedClient();
  if (!active || activePresenceSubscriptions.get(subscriptionKey) !== record) return cancel;
  if (!auth) { scheduleOffline(); return cancel; }
  const refresh = async () => {
    const { data, error } = await auth.client.rpc(rpcName, { target_user_ids: normalizedIds });
    if (!active || activePresenceSubscriptions.get(subscriptionKey) !== record) return;
    if (error) {
      // A transient RPC/network failure is not evidence that every peer went offline.
      // Keep the last verified UI state and retry after the connection has had time to recover.
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (active && activePresenceSubscriptions.get(subscriptionKey) === record) void refresh();
      }, 1_500);
      return;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    const snapshot: Record<string, FriendPresence> = {};
    for (const row of data ?? []) snapshot[row.user_id] = safePresence(row.status);
    for (const userId of normalizedIds) snapshot[userId] ??= safePresence("offline");
    emit(snapshot);
  };
  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void refresh(); }, 40);
  };

  await refresh();
  if (!active || activePresenceSubscriptions.get(subscriptionKey) !== record) return cancel;
  const channelName = uniquePresenceChannelName(
    subscriptionKey === "dm-presence"
      ? `dm-presence:${auth.userId}`
      : realtimeChannelNames.friendPresence(auth.userId),
  );
  const channel = normalizedIds.length
    ? auth.client.channel(channelName).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friend_presence", filter: `user_id=in.(${normalizedIds.join(",")})` },
      scheduleRefresh,
    ).subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleRefresh();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          if (active && activePresenceSubscriptions.get(subscriptionKey) === record) void refresh();
        }, 1_500);
      }
    })
    : null;
  removeRealtimeChannel = channel ? () => { void auth.client.removeChannel(channel); } : undefined;

  if (!active) {
    removeRealtimeChannel?.();
    return cancel;
  }

  // Re-evaluate expiry even when an unclean peer shutdown produces no final database event.
  periodicRefreshTimer = setInterval(scheduleRefresh, 30_000);

  if (typeof window !== "undefined") {
    const refreshOnResume = () => scheduleRefresh();
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    removeLifecycleListeners = () => {
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }

  return cancel;
}

async function subscribe(
  friendIds: string[],
  listener: (snapshot: FriendPresenceSnapshot) => void,
): Promise<() => void> {
  return subscribeWithRpc("friend-presence", friendIds, "list_friend_presence", listener);
}

async function subscribeDirectPeers(
  peerIds: string[],
  listener: (snapshot: FriendPresenceSnapshot) => void,
): Promise<() => void> {
  return subscribeWithRpc("dm-presence", peerIds, "list_direct_conversation_presence", listener);
}

export const friendPresenceService = { subscribe, subscribeDirectPeers, safePresence };
