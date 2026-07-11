import { mockFriendState } from "../../data/mockFriends";
import type { UserStatus } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type FriendPresence = Readonly<{ status: UserStatus; statusText: string }>;
export type FriendPresenceSnapshot = Readonly<Record<string, FriendPresence>>;
export type FriendPresenceOptions = Readonly<{ sharePresence: boolean; ownStatus: UserStatus }>;

function safePresence(status: unknown): FriendPresence {
  if (status === "online") return { status: "online", statusText: "Online" };
  if (status === "idle") return { status: "idle", statusText: "Idle" };
  if (status === "dnd" || status === "busy") return { status: "dnd", statusText: "Busy" };
  return { status: "offline", statusText: "Offline" };
}

function mockSnapshot(friendIds: string[]): FriendPresenceSnapshot {
  const allowed = new Set(friendIds);
  return Object.fromEntries(
    mockFriendState.friends
      .filter((friend) => allowed.has(friend.userId))
      .map((friend) => [friend.userId, safePresence(friend.status)]),
  );
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

async function subscribe(
  friendIds: string[],
  options: FriendPresenceOptions,
  listener: (snapshot: FriendPresenceSnapshot) => void,
): Promise<() => void> {
  const normalizedIds = [...new Set(friendIds.filter(Boolean))].slice(0, 100);
  if (dataSourceService.getStatus().isMock) {
    queueMicrotask(() => listener(mockSnapshot(normalizedIds)));
    return () => undefined;
  }

  const auth = await authenticatedClient();
  if (!auth) return () => undefined;
  let active = true;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const ownStatus = safePresence(options.ownStatus).status;
  const publishOwnPresence = (status: UserStatus, sharePresence = options.sharePresence) =>
    auth.client.rpc("set_my_friend_presence", { target_status: status, share_presence: sharePresence });
  const refresh = async () => {
    const { data, error } = await auth.client.rpc("list_friend_presence", { target_user_ids: normalizedIds });
    if (!active || error) return;
    const snapshot: Record<string, FriendPresence> = {};
    for (const row of data ?? []) snapshot[row.user_id] = safePresence(row.status);
    for (const friendId of normalizedIds) snapshot[friendId] ??= safePresence("offline");
    listener(snapshot);
  };
  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void refresh(); }, 40);
  };

  await publishOwnPresence(ownStatus);
  await refresh();
  const channel = normalizedIds.length
    ? auth.client.channel(`friend-presence:${auth.userId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friend_presence", filter: `user_id=in.(${normalizedIds.join(",")})` },
      scheduleRefresh,
    ).subscribe()
    : null;
  const heartbeat = setInterval(() => { void publishOwnPresence(ownStatus); }, 45_000);

  return () => {
    active = false;
    clearInterval(heartbeat);
    if (refreshTimer) clearTimeout(refreshTimer);
    if (channel) void auth.client.removeChannel(channel);
    void publishOwnPresence("offline", false);
  };
}

export const friendPresenceService = { subscribe, safePresence };
