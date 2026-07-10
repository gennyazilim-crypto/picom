import { getMockProfileForMember } from "../data/mockProfiles";
import type { Community, Member } from "../types/community";
import type { ProfileActivityItem, ProfileActivityType, ProfileMediaItem, ProfileStatus, UserProfile } from "../types/profile";
import { dataSourceService } from "./dataSourceService";
import type { Json } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";

type ProfileLoadInput = Readonly<{
  member: Member;
  communities: Community[];
  viewerUserId: string;
  followedUserIds: string[];
}>;
type ProfileLoadResult = Readonly<{ ok: true; data: UserProfile }> | Readonly<{ ok: false; error: { code: string; message: string } }>;

const activityTypes = new Set<ProfileActivityType>(["mention", "reply", "reaction", "media_share", "voice_join", "message_post"]);

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asObjects(value: Json | undefined): Array<Record<string, Json | undefined>> {
  return Array.isArray(value) ? value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0) : [];
}

function text(value: Json | undefined): string | undefined { return typeof value === "string" ? value : undefined; }
function count(value: Json | undefined): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0; }
function profileStatus(value: Json | undefined): ProfileStatus {
  if (value === "online" || value === "idle" || value === "offline") return value;
  return value === "dnd" || value === "busy" ? "busy" : "offline";
}

function emptyProductionProfile(base: UserProfile): UserProfile {
  return {
    ...base,
    roles: [], tags: [], media: [], activities: [], activityScore: undefined, preferredLanguage: undefined,
    stats: { communities: 0, posts: 0, mentions: 0, reactions: 0, followers: 0, following: 0, roles: 0 },
  };
}

function mapPayload(payload: Json, base: UserProfile): UserProfile {
  const root = asRecord(payload);
  if (root.can_view_profile !== true) return { ...emptyProductionProfile(base), bio: "This profile is private.", privacyRestricted: true };
  const profile = asRecord(root.profile);
  const roleRows = asObjects(root.roles);
  const roles = roleRows.map((row) => text(row.role_name)).filter((value): value is string => Boolean(value));
  const activities: ProfileActivityItem[] = asObjects(root.activities).flatMap((row) => {
    const id = text(row.id); const type = text(row.type); const title = text(row.title); const preview = text(row.preview); const createdAt = text(row.created_at);
    if (!id || !type || !activityTypes.has(type as ProfileActivityType) || !title || !preview || !createdAt) return [];
    return [{ id, type: type as ProfileActivityType, communityId: text(row.community_id), channelId: text(row.channel_id), messageId: text(row.message_id), title, preview, createdAt }];
  });
  const media: ProfileMediaItem[] = asObjects(root.media).flatMap((row) => {
    const id = text(row.id); const url = text(row.url); const createdAt = text(row.created_at);
    if (!id || !url || !createdAt) return [];
    return [{ id, type: "image" as const, url, thumbnailUrl: text(row.thumbnail_url), title: text(row.title), createdAt }];
  });
  const stats = asRecord(root.stats);
  const uniqueRoles = [...new Set(roles)];
  return {
    ...emptyProductionProfile(base),
    id: text(profile.id) ?? base.id,
    displayName: text(profile.display_name) ?? base.displayName,
    username: text(profile.username) ?? base.username,
    avatarUrl: text(profile.avatar_url),
    status: profileStatus(profile.status),
    statusText: text(profile.status_text),
    bio: text(profile.bio) ?? "",
    joinedAt: text(profile.created_at) ?? base.joinedAt,
    location: text(profile.location),
    timezone: text(profile.timezone),
    roles: uniqueRoles,
    tags: uniqueRoles,
    topRole: uniqueRoles[0],
    mainCommunityId: text(roleRows[0]?.community_id),
    isCurrentUser: base.isCurrentUser,
    stats: {
      communities: count(stats.communities), posts: count(stats.posts), mentions: count(stats.mentions), reactions: count(stats.reactions),
      followers: count(stats.followers), following: count(stats.following), roles: count(stats.roles),
    },
    activities,
    media,
    privacyRestricted: false,
  };
}

async function load(input: ProfileLoadInput): Promise<ProfileLoadResult> {
  const base = getMockProfileForMember(input.member, input.communities, { currentUserId: input.viewerUserId, followedUserIds: input.followedUserIds });
  if (dataSourceService.getStatus().isMock) return { ok: true, data: base };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Profile activity is unavailable until Picom reconnects." } };
  const { data, error } = await client.rpc("get_profile_activity_v3", { target_user_id: input.member.userId, result_limit: 30 });
  if (error || !data) return { ok: false, error: { code: "PROFILE_ACTIVITY_LOAD_FAILED", message: "Picom could not load this profile's activity." } };
  return { ok: true, data: mapPayload(data, base) };
}

export const profileActivityService = { load, emptyProductionProfile };
