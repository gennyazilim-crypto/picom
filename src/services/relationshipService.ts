import { currentUserFollowedUserIds } from "../data/mockFollows";
import { mockFriendState } from "../data/mockFriends";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";

type RelationshipResult<T> = Promise<Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>>;
const mockFollowing = new Set(currentUserFollowedUserIds);
const mockFriends = new Set(mockFriendState.friends.map((friend) => friend.userId));
const mockRequests = new Map(mockFriendState.requests.map((request) => [request.id, request]));

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
  if (dataSourceService.getStatus().isMock) { const id = `friend-request-${userId}`; return { ok: true, data: id }; }
  const auth = await userAndClient(); if (!auth || auth.userId === userId) return { ok: false, error: "Sign in and choose another user." };
  const { data, error } = await auth.client.from("friend_requests").upsert({ sender_id: auth.userId, recipient_id: userId, status: "pending", responded_at: null }, { onConflict: "sender_id,recipient_id" }).select("id").single();
  return error || !data ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not send the friend request." } : { ok: true, data: data.id };
}

export async function acceptFriendRequest(requestId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) { const request = mockRequests.get(requestId); if (request) mockFriends.add(request.userId); mockRequests.delete(requestId); return { ok: true, data: Boolean(request) }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to respond." };
  const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: true });
  return error ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not accept the friend request." } : { ok: true, data };
}

export async function declineFriendRequest(requestId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) { const existed = mockRequests.delete(requestId); return { ok: true, data: existed }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to respond." };
  const { data, error } = await auth.client.rpc("respond_friend_request", { target_request_id: requestId, accept_request: false });
  return error ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not decline the friend request." } : { ok: true, data };
}

export async function removeFriend(userId: string): RelationshipResult<boolean> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: mockFriends.delete(userId) };
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to remove a friend." };
  const { data, error } = await auth.client.rpc("remove_friend", { other_user_id: userId });
  return error ? { ok: false, error: isRateLimitError(error) ? rateLimitUserMessage : "Could not remove the friend." } : { ok: true, data };
}

export const relationshipService = { followUser, unfollowUser, getFollowing, getFollowers, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend };
