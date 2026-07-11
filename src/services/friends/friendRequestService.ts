import { mockFriendState } from "../../data/mockFriends";
import { currentUserId } from "../../data/mockCommunities";
import type {
  FriendConnection,
  FriendNotification,
  FriendRequest,
  FriendRequestCounts,
  FriendServiceErrorCode,
  FriendServiceResult,
  FriendState,
  FriendSuggestion,
} from "../../types/friends";
import { dataSourceService } from "../dataSourceService";
import { notificationCenterService } from "../notificationCenterService";
import { notificationService } from "../notificationService";
import { isRateLimitError, rateLimitUserMessage } from "../rateLimitError";
import { settingsService } from "../settingsService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { userBlockingService } from "../userBlockingService";

type FriendStateListener = (state: FriendState) => void;
type FriendNotificationListener = (notification: FriendNotification) => void;

export type FriendNotificationRouteResult = Readonly<{
  routed: boolean;
  desktop: boolean;
  reason?: string;
}>;

interface FriendRequestDataSource {
  getState(): Promise<FriendServiceResult<FriendState>>;
  sendRequest(userId: string): Promise<FriendServiceResult<string>>;
  acceptRequest(requestId: string): Promise<FriendServiceResult<boolean>>;
  declineRequest(requestId: string): Promise<FriendServiceResult<boolean>>;
  cancelRequest(requestId: string): Promise<FriendServiceResult<boolean>>;
  removeFriend(userId: string): Promise<FriendServiceResult<boolean>>;
  blockFriend(friend: Pick<FriendConnection, "userId" | "displayName" | "username">): Promise<FriendServiceResult<boolean>>;
  subscribeToState(listener: FriendStateListener): Promise<() => void>;
  subscribeToNotifications(listener: FriendNotificationListener): Promise<() => void>;
}

function failure<T>(code: FriendServiceErrorCode, message: string, retryable = false): FriendServiceResult<T> {
  return { ok: false, error: message, details: { code, message, retryable } };
}

export function calculateFriendRequestCounts(
  friends: FriendConnection[],
  requests: FriendRequest[],
): FriendRequestCounts {
  const active = requests.filter((request) => request.status === "pending");
  const incoming = active.filter((request) => request.direction === "incoming").length;
  const outgoing = active.filter((request) => request.direction === "outgoing").length;
  return { friends: friends.length, incoming, outgoing, pending: incoming + outgoing };
}

function buildState(
  friends: FriendConnection[],
  requests: FriendRequest[],
  suggestions: FriendSuggestion[] = mockFriendState.suggestions,
): FriendState {
  return {
    friends,
    requests,
    suggestions: suggestions.filter(
      (candidate) => !friends.some((friend) => friend.userId === candidate.userId)
        && !requests.some((request) => request.userId === candidate.userId && request.status === "pending")
        && !userBlockingService.isBlocked(candidate.userId),
    ),
    counts: calculateFriendRequestCounts(friends, requests),
  };
}

function mapRemoteState(value: unknown, suggestionValue: unknown): FriendState {
  const source = (value && typeof value === "object" ? value : {}) as {
    friends?: Array<Record<string, unknown>>;
    requests?: Array<Record<string, unknown>>;
  };
  const friends: FriendConnection[] = (source.friends ?? []).map((row) => ({
    id: String(row.id ?? ""),
    userId: String(row.userId ?? ""),
    displayName: String(row.displayName ?? "Picom user"),
    username: String(row.username ?? "user"),
    avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : undefined,
    status: row.status === "online" || row.status === "idle"
      ? row.status
      : row.status === "busy" || row.status === "dnd" ? "dnd" : "offline",
    statusText: String(row.statusText ?? "Friend"),
    favorite: false,
    mutualCommunityCount: Number(row.mutualCommunityCount ?? 0),
  }));
  const requests: FriendRequest[] = (source.requests ?? []).map((row) => ({
    id: String(row.id ?? ""),
    userId: String(row.userId ?? ""),
    displayName: String(row.displayName ?? "Picom user"),
    username: String(row.username ?? "user"),
    direction: row.direction === "incoming" ? "incoming" : "outgoing",
    status: "pending",
    note: row.direction === "incoming" ? "Wants to connect with you." : "Request pending.",
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  }));
  const suggestions: FriendSuggestion[] = (Array.isArray(suggestionValue) ? suggestionValue : []).map((row) => {
    const source = row as Record<string, unknown>;
    const mutualCommunityCount = Number(source.mutual_community_count ?? 0);
    const followedByCurrentUser = source.followed_by_current_user === true;
    return {
      userId: String(source.user_id ?? ""),
      displayName: String(source.display_name ?? "Picom user"),
      username: String(source.username ?? "user"),
      avatarUrl: typeof source.avatar_url === "string" ? source.avatar_url : undefined,
      mutualCommunityCount,
      followedByCurrentUser,
      reason: followedByCurrentUser
        ? `${mutualCommunityCount} shared ${mutualCommunityCount === 1 ? "community" : "communities"} and you follow this person.`
        : `${mutualCommunityCount} shared ${mutualCommunityCount === 1 ? "community" : "communities"}.`,
    };
  });
  return buildState(friends, requests, suggestions);
}

function classifyRemoteError<T>(error: { message?: string; code?: string } | null, fallback: string): FriendServiceResult<T> {
  if (isRateLimitError(error)) return failure("RATE_LIMITED", rateLimitUserMessage, true);
  const message = error?.message ?? "";
  const normalized = message.toLowerCase();
  if (message.includes("FRIEND_REQUEST_BLOCKED") || normalized.includes("blocked") || normalized.includes("unavailable for this relationship")) return failure("BLOCKED", "This friend request is unavailable because one of you blocked the other.");
  if (message.includes("FRIEND_REQUEST_PRIVACY")) return failure("PRIVACY_DENIED", "This user is not accepting friend requests from you.");
  if (message.includes("FRIEND_REQUEST_COOLDOWN")) return failure("COOLDOWN", "Please wait before sending another friend request to this user.", true);
  if (message.includes("FRIEND_REQUEST_EXISTS") || normalized.includes("already pending")) return failure("DUPLICATE_REQUEST", "A friend request is already pending.");
  if (message.includes("ALREADY_FRIENDS") || normalized.includes("already friends")) return failure("ALREADY_FRIENDS", "You are already friends.");
  if (normalized.includes("incoming friend requests")) return failure("DIRECTION_DENIED", "Only incoming friend requests can be answered.");
  if (normalized.includes("outgoing friend requests")) return failure("DIRECTION_DENIED", "Only outgoing friend requests can be cancelled.");
  if (normalized.includes("not found")) return failure("NOT_FOUND", "The friend request is no longer available.");
  if (error?.code === "PGRST301" || normalized.includes("jwt") || normalized.includes("auth")) return failure("AUTH_REQUIRED", "Sign in to manage friends.");
  if (normalized.includes("fetch") || normalized.includes("network")) return failure("NETWORK", "The friend service is temporarily unreachable.", true);
  return failure("UNKNOWN", fallback, true);
}

const mockFriends = new Map(mockFriendState.friends.map((friend) => [friend.userId, friend]));
const mockRequests = new Map(mockFriendState.requests.map((request) => [request.id, request]));
const mockRequestHistory = new Map(mockFriendState.requests.map((request) => [request.id, request]));
const mockStateListeners = new Set<FriendStateListener>();
const mockNotificationListeners = new Set<FriendNotificationListener>();

function getMockState(): FriendState {
  return buildState([...mockFriends.values()], [...mockRequests.values()]);
}

function emitMockState(): void {
  const snapshot = getMockState();
  for (const listener of mockStateListeners) listener(snapshot);
}

function transitionMockRequest(
  requestId: string,
  status: FriendRequest["status"],
  expectedDirection: FriendRequest["direction"],
): FriendRequest | null {
  const request = mockRequests.get(requestId);
  if (!request || request.status !== "pending" || request.direction !== expectedDirection) return null;
  mockRequestHistory.set(requestId, { ...request, status });
  mockRequests.delete(requestId);
  return request;
}

const mockFriendDataSource: FriendRequestDataSource = {
  async getState() { return { ok: true, data: getMockState() }; },
  async sendRequest(userId) {
    const normalized = userId.trim();
    if (!normalized) return failure("INVALID_INPUT", "Choose a user before sending a friend request.");
    if (normalized === currentUserId) return failure("SELF_REQUEST", "You cannot send a friend request to your own account.");
    if (userBlockingService.isBlocked(normalized)) return failure("BLOCKED", "Friend requests are unavailable for this relationship.");
    if (mockFriends.has(normalized)) return failure("ALREADY_FRIENDS", "This user is already a friend.");
    if ([...mockRequests.values()].some((request) => request.userId === normalized && request.status === "pending")) return failure("DUPLICATE_REQUEST", "A friend request is already pending.");
    const suggestion = mockFriendState.suggestions.find((candidate) => candidate.userId === normalized);
    const id = `friend-request-${normalized}`;
    const request: FriendRequest = {
      id,
      userId: normalized,
      displayName: suggestion?.displayName ?? "Picom user",
      username: suggestion?.username ?? "user",
      direction: "outgoing",
      status: "pending",
      note: "Request pending.",
      createdAt: new Date().toISOString(),
    };
    mockRequests.set(id, request);
    mockRequestHistory.set(id, request);
    emitMockState();
    return { ok: true, data: id };
  },
  async acceptRequest(requestId) {
    const request = transitionMockRequest(requestId, "accepted", "incoming");
    if (!request) return failure("DIRECTION_DENIED", "Only incoming friend requests can be accepted.");
    mockFriends.set(request.userId, { userId: request.userId, displayName: request.displayName, username: request.username, status: "online", statusText: "New friend", favorite: false, mutualCommunityCount: 1 });
    emitMockState();
    return { ok: true, data: true };
  },
  async declineRequest(requestId) {
    if (!transitionMockRequest(requestId, "declined", "incoming")) return failure("DIRECTION_DENIED", "Only incoming friend requests can be declined.");
    emitMockState();
    return { ok: true, data: true };
  },
  async cancelRequest(requestId) {
    if (!transitionMockRequest(requestId, "cancelled", "outgoing")) return failure("DIRECTION_DENIED", "Only outgoing friend requests can be cancelled.");
    emitMockState();
    return { ok: true, data: true };
  },
  async removeFriend(userId) {
    const removed = mockFriends.delete(userId);
    if (!removed) return failure("NOT_FOUND", "This friendship is no longer available.");
    emitMockState();
    return { ok: true, data: true };
  },
  async blockFriend(friend) {
    if (!await userBlockingService.setBlockedUser(friend, true)) return failure("UNKNOWN", "Could not block this user.", true);
    mockFriends.delete(friend.userId);
    for (const [requestId, request] of mockRequests) {
      if (request.userId === friend.userId) transitionMockRequest(requestId, "cancelled", request.direction);
    }
    emitMockState();
    return { ok: true, data: true };
  },
  async subscribeToState(listener) {
    mockStateListeners.add(listener);
    queueMicrotask(() => listener(getMockState()));
    return () => mockStateListeners.delete(listener);
  },
  async subscribeToNotifications(listener) {
    mockNotificationListeners.add(listener);
    return () => mockNotificationListeners.delete(listener);
  },
};

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

const supabaseFriendDataSource: FriendRequestDataSource = {
  async getState() {
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to load friends.");
    const [stateResult, suggestionResult] = await Promise.all([
      auth.client.rpc("list_friend_relationship_state", {}),
      auth.client.rpc("list_friend_suggestions", { result_limit: 12 }),
    ]);
    if (stateResult.error) return classifyRemoteError(stateResult.error, "Could not load friends.");
    if (suggestionResult.error) return classifyRemoteError(suggestionResult.error, "Could not load friend suggestions.");
    return { ok: true, data: mapRemoteState(stateResult.data, suggestionResult.data) };
  },
  async sendRequest(userId) {
    const normalized = userId.trim();
    if (!normalized) return failure("INVALID_INPUT", "Choose a user before sending a friend request.");
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to send a friend request.");
    if (auth.userId === normalized) return failure("SELF_REQUEST", "Choose another user.");
    const { data, error } = await auth.client.rpc("send_friend_request", { target_user_id: normalized });
    return error || !data ? classifyRemoteError(error, "Could not send the friend request.") : { ok: true, data };
  },
  async acceptRequest(requestId) {
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to respond.");
    const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: true });
    return error ? classifyRemoteError(error, "Could not accept the friend request.") : { ok: true, data };
  },
  async declineRequest(requestId) {
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to respond.");
    const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: false });
    return error ? classifyRemoteError(error, "Could not decline the friend request.") : { ok: true, data };
  },
  async cancelRequest(requestId) {
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to cancel the request.");
    const { data, error } = await auth.client.rpc("cancel_friend_request", { target_request_id: requestId });
    return error ? classifyRemoteError(error, "Could not cancel the friend request.") : { ok: true, data };
  },
  async removeFriend(userId) {
    const auth = await authenticatedClient();
    if (!auth) return failure("AUTH_REQUIRED", "Sign in to remove a friend.");
    const { data, error } = await auth.client.rpc("remove_friend", { other_user_id: userId });
    return error ? classifyRemoteError(error, "Could not remove the friend.") : { ok: true, data };
  },
  async blockFriend(friend) {
    return await userBlockingService.setBlockedUser(friend, true)
      ? { ok: true, data: true }
      : failure("UNKNOWN", "Could not block this user.", true);
  },
  async subscribeToState(listener) {
    const auth = await authenticatedClient();
    if (!auth) return () => undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void supabaseFriendDataSource.getState().then((result) => {
          if (active && result.ok) listener(result.data);
        });
      }, 40);
    };
    const channels = [
      auth.client.channel(`friend-requests-sent:${auth.userId}`).on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `sender_id=eq.${auth.userId}` }, scheduleRefresh).subscribe(),
      auth.client.channel(`friend-requests-received:${auth.userId}`).on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${auth.userId}` }, scheduleRefresh).subscribe(),
      auth.client.channel(`friendships-low:${auth.userId}`).on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `user_low_id=eq.${auth.userId}` }, scheduleRefresh).subscribe(),
      auth.client.channel(`friendships-high:${auth.userId}`).on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `user_high_id=eq.${auth.userId}` }, scheduleRefresh).subscribe(),
    ];
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      for (const channel of channels) void auth.client.removeChannel(channel);
    };
  },
  async subscribeToNotifications(listener) {
    const auth = await authenticatedClient();
    if (!auth) return () => undefined;
    const channel = auth.client
      .channel(`friend-notifications:${auth.userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_request_notifications", filter: `recipient_id=eq.${auth.userId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        listener({
          id: String(row.id),
          actorUserId: String(row.actor_id),
          eventType: row.event_type === "request_accepted" ? "request_accepted" : "request_sent",
          requestId: typeof row.request_id === "string" ? row.request_id : undefined,
          createdAt: String(row.created_at),
        });
      })
      .subscribe();
    return () => { void auth.client.removeChannel(channel); };
  },
};

function currentDataSource(): FriendRequestDataSource {
  return dataSourceService.getStatus().isMock ? mockFriendDataSource : supabaseFriendDataSource;
}

export async function routeFriendNotification(notification: FriendNotification): Promise<FriendNotificationRouteResult> {
  const preferences = settingsService.getSettings().notificationSettings;
  const accepted = notification.eventType === "request_accepted";
  const enabled = accepted ? preferences.friendAcceptances : preferences.friendRequests;
  if (!enabled) return { routed: false, desktop: false, reason: "Friend notification disabled by user preference." };

  const title = accepted ? "Friend request accepted" : "New friend request";
  const preview = accepted ? "A Picom user accepted your friend request." : "A Picom user sent you a friend request.";
  notificationCenterService.add({
    id: `friend-${notification.id}`,
    category: "system",
    preferenceCategory: accepted ? "friend_acceptance" : "friend_request",
    title,
    preview,
    createdAt: notification.createdAt,
    context: { kind: "system", userId: notification.actorUserId, label: "Friends" },
  });
  const desktop = await notificationService.showNotification({
    title,
    body: accepted ? "Your Picom connection is ready." : "Open Friends to review it.",
    category: accepted ? "friend_acceptance" : "friend_request",
    tag: `friend-${notification.id}`,
  });
  return { routed: true, desktop: desktop.ok, reason: desktop.reason };
}

export const friendRequestService = {
  getFriendState: () => currentDataSource().getState(),
  sendFriendRequest: (userId: string) => currentDataSource().sendRequest(userId),
  acceptFriendRequest: (requestId: string) => currentDataSource().acceptRequest(requestId),
  declineFriendRequest: (requestId: string) => currentDataSource().declineRequest(requestId),
  cancelFriendRequest: (requestId: string) => currentDataSource().cancelRequest(requestId),
  removeFriend: (userId: string) => currentDataSource().removeFriend(userId),
  blockFriend: (friend: Pick<FriendConnection, "userId" | "displayName" | "username">) => currentDataSource().blockFriend(friend),
  subscribeToFriendState: (listener: FriendStateListener) => currentDataSource().subscribeToState(listener),
  subscribeToFriendNotifications: (listener: FriendNotificationListener) => currentDataSource().subscribeToNotifications(listener),
  routeFriendNotification,
};
