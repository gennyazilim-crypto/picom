import { currentUserFollowedUserIds } from "../data/mockFollows";
import { mockFriendState } from "../data/mockFriends";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";
import { userBlockingService } from "./userBlockingService";
import type { FriendConnection, FriendNotification, FriendRequest, FriendState } from "../types/friends";

type RelationshipResult<T> = Promise<Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>>;
const mockFollowing = new Set(currentUserFollowedUserIds);
const mockFriends = new Map(mockFriendState.friends.map((friend) => [friend.userId, friend]));
const mockRequests = new Map(mockFriendState.requests.map((request) => [request.id, request]));

function errorMessage(error: { message?: string } | null, fallback: string): string {
  if (isRateLimitError(error)) return rateLimitUserMessage;
  const message = error?.message ?? "";
  if (message.includes("FRIEND_REQUEST_PRIVACY")) return "This user is not accepting friend requests from you.";
  if (message.includes("FRIEND_REQUEST_BLOCKED")) return "This friend request is unavailable because one of you blocked the other.";
  if (message.includes("FRIEND_REQUEST_COOLDOWN")) return "Please wait before sending another friend request to this user.";
  if (message.includes("FRIEND_REQUEST_EXISTS")) return "A friend request is already pending.";
  if (message.includes("ALREADY_FRIENDS")) return "You are already friends.";
  return fallback;
}

function cloneMockState(): FriendState {
  return { friends: [...mockFriends.values()], requests: [...mockRequests.values()], suggestions: mockFriendState.suggestions.filter((item) => !mockFriends.has(item.userId) && ![...mockRequests.values()].some((request) => request.userId === item.userId)) };
}

type RemoteFriendState = { friends?: Array<Record<string, unknown>>; requests?: Array<Record<string, unknown>> };
function mapRemoteFriendState(value: unknown): FriendState {
  const source = (value && typeof value === "object" ? value : {}) as RemoteFriendState;
  const friends: FriendConnection[] = (source.friends ?? []).map((row) => ({
    id: String(row.id ?? ""), userId: String(row.userId ?? ""), displayName: String(row.displayName ?? "Picom user"), username: String(row.username ?? "user"), avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : undefined,
    status: row.status === "online" || row.status === "idle" ? row.status : row.status === "busy" || row.status === "dnd" ? "dnd" : "offline", statusText: String(row.statusText ?? "Friend"), favorite: false, mutualCommunityCount: Number(row.mutualCommunityCount ?? 0),
  }));
  const requests: FriendRequest[] = (source.requests ?? []).map((row) => ({
    id: String(row.id ?? ""), userId: String(row.userId ?? ""), displayName: String(row.displayName ?? "Picom user"), username: String(row.username ?? "user"), direction: row.direction === "incoming" ? "incoming" : "outgoing", note: row.direction === "incoming" ? "Wants to connect with you." : "Request pending.", createdAt: String(row.createdAt ?? new Date().toISOString()),
  }));
  return { friends, requests, suggestions: mockFriendState.suggestions.filter((item) => !friends.some((friend) => friend.userId === item.userId) && !requests.some((request) => request.userId === item.userId)) };
}

async function userAndClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export async function followUser(userId: string): RelationshipResult<void> {
  if (!userId.trim()) return { ok: false, error: "User ID is required." };
  if (dataSourceService.getStatus().isMock) { mockFollowing.add(userId); return { ok: true, data: undefined }; }
  const auth = await userAndClient(); if (!auth || auth.userId === userId) return { ok: false, error: "Sign in and choose another user." };
  const { error } = await auth.client.from("user_follows").upsert({ follower_id: auth.userId, followed_id: userId }, { onConflict: "follower_id,followed_id" });
  return error ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not follow this user." } : { ok: true, data: undefined };
}

export async function unfollowUser(userId: string): RelationshipResult<void> {
  if (dataSourceService.getStatus().isMock) { mockFollowing.delete(userId); return { ok: true, data: undefined }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to update follows." };
  const { error } = await auth.client.from("user_follows").delete().eq("follower_id", auth.userId).eq("followed_id", userId);
  return error ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not unfollow this user." } : { ok: true, data: undefined };
}

export async function getFollowing(): RelationshipResult<string[]> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: [...mockFollowing] };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to load follows." };
  const { data, error } = await auth.client.from("user_follows").select("followed_id").eq("follower_id", auth.userId);
  return error ? { ok: false, error: "Could not load following." } : { ok: true, data: (data ?? []).map((row) => row.followed_id) };
}

export async function getFollowers(): RelationshipResult<string[]> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: [] };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to load followers." };
  const { data, error } = await auth.client.from("user_follows").select("follower_id").eq("followed_id", auth.userId);
  return error ? { ok: false, error: "Could not load followers." } : { ok: true, data: (data ?? []).map((row) => row.follower_id) };
}

export async function sendFriendRequest(userId: string): RelationshipResult<string> {
  if (dataSourceService.getStatus().isMock) { const existing=[...mockRequests.values()].find((item)=>item.userId===userId); if(existing)return {ok:false,error:"A friend request is already pending."}; const suggestion=mockFriendState.suggestions.find((item)=>item.userId===userId); const id=`friend-request-${userId}`; mockRequests.set(id,{id,userId,displayName:suggestion?.displayName??"Picom user",username:suggestion?.username??"user",direction:"outgoing",note:"Request pending.",createdAt:new Date().toISOString()}); return { ok: true, data: id }; }
  const auth = await userAndClient(); if (!auth || auth.userId === userId) return { ok: false, error: "Sign in and choose another user." };
  const { data, error } = await auth.client.rpc("send_friend_request", { target_user_id: userId });
  return error || !data ? { ok: false, error: errorMessage(error, "Could not send the friend request.") } : { ok: true, data };
}

export async function acceptFriendRequest(requestId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) { const request = mockRequests.get(requestId); if (request) mockFriends.set(request.userId,{userId:request.userId,displayName:request.displayName,username:request.username,status:"online",statusText:"New friend",favorite:false,mutualCommunityCount:1}); mockRequests.delete(requestId); return { ok: true, data: Boolean(request) }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to respond." };
  const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: true });
  return error ? { ok: false, error: errorMessage(error, "Could not accept the friend request.") } : { ok: true, data };
}

export async function declineFriendRequest(requestId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) { const existed = mockRequests.delete(requestId); return { ok: true, data: existed }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to respond." };
  const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: false });
  return error ? { ok: false, error: errorMessage(error, "Could not decline the friend request.") } : { ok: true, data };
}

export async function cancelFriendRequest(requestId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: mockRequests.delete(requestId) };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to cancel the request." };
  const { data, error } = await auth.client.rpc("cancel_friend_request", { target_request_id: requestId });
  return error ? { ok: false, error: errorMessage(error, "Could not cancel the friend request.") } : { ok: true, data };
}

export async function removeFriend(userId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: mockFriends.delete(userId) };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to remove a friend." };
  const { data, error } = await auth.client.rpc("remove_friend", { other_user_id: userId });
  return error ? { ok: false, error: errorMessage(error, "Could not remove the friend.") } : { ok: true, data };
}

export async function blockFriend(friend: Pick<FriendConnection, "userId" | "displayName" | "username">): RelationshipResult<boolean> {
  const blocked = await userBlockingService.setBlockedUser(friend, true);
  if (!blocked) return { ok: false, error: "Could not block this user." };
  if (dataSourceService.getStatus().isMock) mockFriends.delete(friend.userId);
  for (const [id, request] of mockRequests) if (request.userId === friend.userId) mockRequests.delete(id);
  return { ok: true, data: true };
}

export async function getFriendState(): RelationshipResult<FriendState> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: cloneMockState() };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to load friends." };
  const { data, error } = await auth.client.rpc("list_friend_relationship_state", {});
  return error ? { ok: false, error: "Could not load friends." } : { ok: true, data: mapRemoteFriendState(data) };
}

export async function subscribeToFriendNotifications(listener: (notification: FriendNotification) => void): Promise<() => void> {
  if (dataSourceService.getStatus().isMock) return () => undefined;
  const auth = await userAndClient(); if (!auth) return () => undefined;
  const channel = auth.client.channel(`friend-notifications:${auth.userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_request_notifications", filter: `recipient_id=eq.${auth.userId}` }, (payload) => {
    const row = payload.new as Record<string, unknown>;
    listener({ id: String(row.id), actorUserId: String(row.actor_id), eventType: row.event_type === "request_accepted" ? "request_accepted" : "request_sent", requestId: typeof row.request_id === "string" ? row.request_id : undefined, createdAt: String(row.created_at) });
  }).subscribe();
  return () => { void auth.client.removeChannel(channel); };
}

export const relationshipService = { followUser, unfollowUser, getFollowing, getFollowers, getFriendState, sendFriendRequest, acceptFriendRequest, declineFriendRequest, cancelFriendRequest, removeFriend, blockFriend, subscribeToFriendNotifications };
