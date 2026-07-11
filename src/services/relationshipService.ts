import { currentUserFollowedUserIds } from "../data/mockFollows";
import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { friendRequestService } from "./friends/friendRequestService";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";
import { getSupabaseClient } from "./supabase/supabaseClient";

type RelationshipResult<T> = Promise<Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>>;
const mockFollowing = new Set(currentUserFollowedUserIds);

async function userAndClient() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export async function followUser(userId: string): RelationshipResult<void> {
  if (!userId.trim()) return { ok: false, error: "User ID is required." };
  if (dataSourceService.getStatus().isMock && userId === currentUserId) return { ok: false, error: "You cannot follow your own account." };
  if (dataSourceService.getStatus().isMock) { mockFollowing.add(userId); return { ok: true, data: undefined }; }
  const auth = await userAndClient(); if (!auth || auth.userId === userId) return { ok: false, error: "Sign in and choose another user." };
  const { error } = await auth.client.rpc("follow_user", { target_user_id: userId });
  if (!error) return { ok: true, data: undefined };
  if (isRateLimitError(error)) return { ok: false, error: rateLimitUserMessage };
  if (error.message.includes("FOLLOW_BLOCKED")) return { ok: false, error: "This follow is unavailable because one of you blocked the other." };
  if (error.message.includes("PROFILE_NOT_VISIBLE")) return { ok: false, error: "This profile is not available to follow." };
  return { ok: false, error: "Could not follow this user." };
}

export async function unfollowUser(userId: string): RelationshipResult<void> {
  if (!userId.trim() || (dataSourceService.getStatus().isMock && userId === currentUserId)) return { ok: false, error: "Choose another user." };
  if (dataSourceService.getStatus().isMock) { mockFollowing.delete(userId); return { ok: true, data: undefined }; }
  const auth = await userAndClient(); if (!auth) return { ok: false, error: "Sign in to update follows." };
  const { error } = await auth.client.rpc("unfollow_user", { target_user_id: userId });
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

export async function subscribeToFollowing(listener: () => void): Promise<() => void> {
  if (dataSourceService.getStatus().isMock) return () => undefined;
  const auth = await userAndClient();
  if (!auth) return () => undefined;
  const channel = auth.client
    .channel(`following:${auth.userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_follows", filter: `follower_id=eq.${auth.userId}` }, listener)
    .subscribe();
  return () => { void auth.client.removeChannel(channel); };
}

export const getFriendState = friendRequestService.getFriendState;
export const sendFriendRequest = friendRequestService.sendFriendRequest;
export const acceptFriendRequest = friendRequestService.acceptFriendRequest;
export const declineFriendRequest = friendRequestService.declineFriendRequest;
export const cancelFriendRequest = friendRequestService.cancelFriendRequest;
export const removeFriend = friendRequestService.removeFriend;
export const blockFriend = friendRequestService.blockFriend;
export const subscribeToFriendState = friendRequestService.subscribeToFriendState;
export const subscribeToFriendNotifications = friendRequestService.subscribeToFriendNotifications;
export const routeFriendNotification = friendRequestService.routeFriendNotification;

export const relationshipService = {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  getFriendState,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockFriend,
  subscribeToFriendState,
  subscribeToFriendNotifications,
  routeFriendNotification,
  subscribeToFollowing,
};
