import type { PodcastCommunitySettings, PodcastCommunityShellSnapshot, PodcastSeries } from "../../types/audio";
import type { Community } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { podcastService } from "./podcastService";

type SettingsRow = Database["public"]["Tables"]["podcast_community_settings"]["Row"];
type SeriesRow = Database["public"]["Tables"]["podcast_series"]["Row"];
export type PodcastCommunityResult = Readonly<{ ok: true; data: PodcastCommunityShellSnapshot }> | Readonly<{ ok: false; error: string }>;

function settingsFromRow(community: Community, row?: SettingsRow | null): PodcastCommunitySettings {
  return {
    communityId: community.id,
    about: row?.about || community.description || "This Podcast community has not published an About note yet.",
    listenerDiscussionEnabled: row?.listener_discussion_enabled === true && Boolean(row.listener_discussion_channel_id),
    listenerDiscussionChannelId: row?.listener_discussion_channel_id ?? undefined,
  };
}

function seriesFromRow(row: SeriesRow): PodcastSeries {
  return { id: row.id, communityId: row.community_id, title: row.title, description: row.description, coverUrl: row.cover_url ?? undefined, createdBy: row.created_by, isActive: row.is_active, createdAt: row.created_at };
}

function getPublisherUserIds(community: Community): string[] {
  const roleIds = new Set(community.roles.filter((role) => role.name === "Owner" || role.name === "Podcast Publisher" || role.name === "Podcast Editor" || role.capabilities?.some((capability) => ["publishPodcasts", "editPodcastMetadata"].includes(capability))).map((role) => role.id));
  return community.members.filter((member) => roleIds.has(member.roleId)).map((member) => member.userId);
}

export const podcastCommunityService = {
  async getShellSnapshot(community: Community): Promise<PodcastCommunityResult> {
    if (community.kind !== "podcast") return { ok: false, error: "This workspace is not a Podcast community." };
    const episodes = await podcastService.getCommunityPodcastEpisodes(community.id);
    if (!episodes.ok) return { ok: false, error: episodes.error.message };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { settings: settingsFromRow(community), episodes: episodes.data, series: [], publisherUserIds: getPublisherUserIds(community) } };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Podcast publishing data is unavailable while Supabase is not configured." };
    const [settings, series] = await Promise.all([
      client.from("podcast_community_settings").select("community_id,about,listener_discussion_enabled,listener_discussion_channel_id,created_at,updated_at").eq("community_id", community.id).maybeSingle(),
      client.from("podcast_series").select("id,community_id,title,description,cover_url,created_by,is_active,created_at,updated_at").eq("community_id", community.id).eq("is_active", true).order("created_at", { ascending: true }).limit(100),
    ]);
    if (settings.error || series.error) return { ok: false, error: "Picom could not load the Podcast library structure." };
    return { ok: true, data: { settings: settingsFromRow(community, settings.data), episodes: episodes.data, series: (series.data ?? []).map(seriesFromRow), publisherUserIds: getPublisherUserIds(community) } };
  },
};
