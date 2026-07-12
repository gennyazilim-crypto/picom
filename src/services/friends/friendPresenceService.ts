import { mockFriendState } from "../../data/mockFriends";
import type { UserStatus } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { realtimeChannelNames } from "../supabase/realtimeService";

export type FriendPresence = Readonly<{ status: UserStatus; statusText: string }>;
export type FriendPresenceSnapshot = Readonly<Record<string, FriendPresence>>;

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

  await refresh();
  const channel = normalizedIds.length
    ? auth.client.channel(realtimeChannelNames.friendPresence(auth.userId)).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friend_presence", filter: `user_id=in.(${normalizedIds.join(",")})` },
      scheduleRefresh,
    ).subscribe()
    : null;
  return () => {
    active = false;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (channel) void auth.client.removeChannel(channel);
  };
}

export const friendPresenceService = { subscribe, safePresence };
