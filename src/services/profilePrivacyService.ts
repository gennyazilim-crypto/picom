import type { UserProfile } from "../types/profile";
import type { ProfilePrivacyProjection, ProfilePrivacySettings } from "../types/profilePrivacy";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.profilePrivacy.v2";
type ProfilePrivacyListener = (settings: ProfilePrivacySettings) => void;
const listeners = new Set<ProfilePrivacyListener>();

export const defaultProfilePrivacySettings: ProfilePrivacySettings = {
  visibility: "everyone",
  showOnlineStatus: true,
  showLocation: true,
  showTimezone: true,
  showActivity: true,
  showMedia: true,
  showCommunities: true,
  showFriends: true,
  showFollows: true,
  showAudio: true,
};

export const defaultProfilePrivacyProjection: ProfilePrivacyProjection = { ...defaultProfilePrivacySettings, canViewProfile: true };
export const restrictedProfilePrivacyProjection: ProfilePrivacyProjection = {
  ...defaultProfilePrivacySettings,
  visibility: "friends",
  canViewProfile: false,
  showOnlineStatus: false,
  showLocation: false,
  showTimezone: false,
  showActivity: false,
  showMedia: false,
  showCommunities: false,
  showFriends: false,
  showFollows: false,
  showAudio: false,
};

function readLocal(): ProfilePrivacySettings {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ProfilePrivacySettings> | null;
    return { ...defaultProfilePrivacySettings, ...parsed };
  } catch {
    return defaultProfilePrivacySettings;
  }
}

function writeLocal(settings: ProfilePrivacySettings): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Restricted runtime fallback. */ }
  for (const listener of listeners) listener({ ...settings });
}

export const profilePrivacyService = {
  getLocalSettings(): ProfilePrivacySettings { return readLocal(); },
  subscribe(listener: ProfilePrivacyListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async getOwnSettings(): Promise<ProfilePrivacySettings> {
    if (dataSourceService.getStatus().isMock) return readLocal();
    const client = getSupabaseClient(); if (!client) return readLocal();
    const { data, error } = await client.rpc("get_own_profile_privacy_v3", {});
    const row = data?.[0];
    if (error || !row) return readLocal();
    const settings: ProfilePrivacySettings = {
      visibility: row.profile_visibility,
      showOnlineStatus: row.show_online_status,
      showLocation: row.show_location,
      showTimezone: row.show_timezone,
      showActivity: row.show_activity,
      showMedia: row.show_media,
      showCommunities: row.show_communities,
      showFriends: row.show_friends,
      showFollows: row.show_follows,
      showAudio: row.show_audio,
    };
    writeLocal(settings);
    return settings;
  },

  async updateOwn(partial: Partial<ProfilePrivacySettings>): Promise<{ ok: boolean; settings: ProfilePrivacySettings }> {
    const previous = readLocal();
    const settings = { ...previous, ...partial };
    writeLocal(settings);
    if (dataSourceService.getStatus().isMock) return { ok: true, settings };
    const client = getSupabaseClient(); if (!client) { writeLocal(previous); return { ok: false, settings: previous }; }
    const { data, error } = await client.rpc("update_profile_privacy_v3", {
      next_visibility: settings.visibility,
      next_show_online_status: settings.showOnlineStatus,
      next_show_location: settings.showLocation,
      next_show_timezone: settings.showTimezone,
      next_show_activity: settings.showActivity,
      next_show_media: settings.showMedia,
      next_show_communities: settings.showCommunities,
      next_show_friends: settings.showFriends,
      next_show_follows: settings.showFollows,
      next_show_audio: settings.showAudio,
    });
    if (error || !data) { writeLocal(previous); return { ok: false, settings: previous }; }
    return { ok: true, settings };
  },

  async getProjection(input: { targetUserId: string; viewerUserId: string; hasSharedCommunity: boolean; isFriend: boolean }): Promise<ProfilePrivacyProjection> {
    if (dataSourceService.getStatus().isMock) {
      const owner = input.targetUserId === input.viewerUserId;
      const settings = owner ? readLocal() : defaultProfilePrivacySettings;
      const canView = owner || settings.visibility === "everyone" || (settings.visibility === "shared_communities" && input.hasSharedCommunity) || (settings.visibility === "friends" && input.isFriend);
      const trusted = owner || input.hasSharedCommunity || input.isFriend;
      return {
        ...settings,
        canViewProfile: canView,
        showOnlineStatus: canView && (owner || settings.showOnlineStatus),
        showLocation: canView && settings.showLocation,
        showTimezone: canView && settings.showTimezone,
        showActivity: canView && settings.showActivity && trusted,
        showMedia: canView && settings.showMedia && trusted,
        showCommunities: canView && settings.showCommunities && trusted,
        showFriends: canView && settings.showFriends && trusted,
        showFollows: canView && settings.showFollows && trusted,
        showAudio: canView && settings.showAudio,
      };
    }
    const client = getSupabaseClient(); if (!client) return restrictedProfilePrivacyProjection;
    const { data, error } = await client.rpc("get_profile_privacy_projection_v3", { target_user_id: input.targetUserId });
    const row = data?.[0];
    return error || !row ? restrictedProfilePrivacyProjection : {
      visibility: row.profile_visibility,
      canViewProfile: row.can_view_profile,
      showOnlineStatus: row.show_online_status,
      showLocation: row.show_location,
      showTimezone: row.show_timezone,
      showActivity: row.show_activity,
      showMedia: row.show_media,
      showCommunities: row.show_communities,
      showFriends: row.show_friends,
      showFollows: row.show_follows,
      showAudio: row.show_audio,
      location: row.location ?? undefined,
      timezone: row.timezone ?? undefined,
    };
  },

  applyProjection(profile: UserProfile, projection: ProfilePrivacyProjection): UserProfile {
    if (!projection.canViewProfile) return {
      ...profile,
      status: "offline",
      statusText: undefined,
      bio: "This profile is private.",
      roles: [], tags: [], location: undefined, timezone: undefined, mainCommunityId: undefined, topRole: undefined,
      activities: [], media: [],
      stats: { communities: 0, posts: 0, mentions: 0, reactions: 0, followers: 0, following: 0, roles: 0 },
      privacy: restrictedProfilePrivacyProjection,
      privacyRestricted: true,
    };
    return {
      ...profile,
      status: projection.showOnlineStatus ? profile.status : "offline",
      statusText: projection.showOnlineStatus ? profile.statusText : undefined,
      location: projection.showLocation ? (projection.location ?? profile.location) : undefined,
      timezone: projection.showTimezone ? (projection.timezone ?? profile.timezone) : undefined,
      activities: projection.showActivity ? profile.activities : [],
      media: projection.showMedia ? profile.media : [],
      roles: projection.showCommunities ? profile.roles : [],
      mainCommunityId: projection.showCommunities ? profile.mainCommunityId : undefined,
      topRole: projection.showCommunities ? profile.topRole : undefined,
      stats: {
        ...profile.stats,
        communities: projection.showCommunities ? profile.stats.communities : 0,
        roles: projection.showCommunities ? profile.stats.roles : 0,
        followers: projection.showFollows ? profile.stats.followers : 0,
        following: projection.showFollows ? profile.stats.following : 0,
      },
      privacy: projection,
      privacyRestricted: false,
    };
  },
};
