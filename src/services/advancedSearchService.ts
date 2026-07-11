import type { Channel, Community, Message } from "../types/community";
import type { MentionItem } from "../types/mentions";
import type { SavedMessageRecord } from "./savedMessageService";
import { canViewChannel, getCommunityAccess } from "./permissions/communityPermissions";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { normalizeSearchQuery, rankSearchResults } from "../utils/searchRelevance";
import { audioDataSource } from "./audio/audioDataSource";

export type AdvancedSearchCategory = "People" | "Communities" | "Channels" | "Messages" | "Mentions" | "Saved" | "Media" | "Radio" | "Podcasts";
export type AdvancedSearchResult = Readonly<{
  id: string;
  category: AdvancedSearchCategory;
  label: string;
  detail: string;
  communityId?: string;
  channelId?: string;
  messageId?: string;
  userId?: string;
  attachmentId?: string;
  radioSessionId?: string;
  podcastEpisodeId?: string;
}>;

export type RemoteSearchCategory = "community" | "channel" | "member" | "message" | "mention" | "saved_message" | "radio_session" | "podcast_episode";
export type MessageJumpResolution =
  | Readonly<{ ok: true; community: Community; channel: Channel; message: Message }>
  | Readonly<{ ok: false; reason: string }>;

function includes(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(query));
}

function safeQuery(query: string): string {
  return normalizeSearchQuery(query).replace(/[%_(),]/g, "");
}

export function searchLocal(queryInput: string, communities: Community[], mentions: MentionItem[], currentUserId: string, savedMessages: SavedMessageRecord[] = []): AdvancedSearchResult[] {
  const query = normalizeSearchQuery(queryInput);
  const results: AdvancedSearchResult[] = [];
  const seenUsers = new Set<string>();

  for (const community of communities) {
    const access = getCommunityAccess(currentUserId, community);
    if (!access.isMember && !access.canViewPublicContent) continue;
    if (!query || includes(community.name, query) || includes(community.description, query)) results.push({ id: `search-community-${community.id}`, category: "Communities", label: community.name, detail: access.isVisitor ? "Public community" : "Community", communityId: community.id });
    const visibleChannels = community.categories.flatMap((category) => category.channels).filter((channel) => canViewChannel(access, channel));
    const visibleIds = new Set(visibleChannels.map((channel) => channel.id));
    for (const channel of visibleChannels) if (!query || includes(channel.name, query) || includes(channel.topic, query)) results.push({ id: `search-channel-${channel.id}`, category: "Channels", label: `#${channel.name}`, detail: community.name, communityId: community.id, channelId: channel.id });
    if (access.canViewMemberList) for (const member of community.members) if (!seenUsers.has(member.userId) && (!query || includes(member.displayName, query) || includes(member.username, query))) { seenUsers.add(member.userId); results.push({ id: `search-person-${member.userId}`, category: "People", label: member.displayName, detail: `@${member.username}`, userId: member.userId, communityId: community.id }); }
    for (const message of community.messages) {
      if (!visibleIds.has(message.channelId)) continue;
      if (message.deletedAt) continue;
      if (!query || includes(message.body, query)) results.push({ id: `search-message-${message.id}`, category: "Messages", label: message.body.slice(0, 72) || "Message", detail: community.name, communityId: community.id, channelId: message.channelId, messageId: message.id });
      for (const attachment of message.attachments ?? []) if (!query || includes(attachment.alt, query)) results.push({ id: `search-media-${attachment.id}`, category: "Media", label: attachment.alt ?? "Shared image", detail: community.name, communityId: community.id, channelId: message.channelId, messageId: message.id, attachmentId: attachment.id });
    }
  }

  for (const session of audioDataSource.getSnapshot().radioSessions) {
    if (session.status === "draft" || session.status === "cancelled") continue;
    const community = communities.find((item) => item.id === session.communityId);
    if (!community) continue;
    const access = getCommunityAccess(currentUserId, community);
    if (!access.isMember && !access.canViewPublicContent) continue;
    if (query && !includes(session.title, query) && !includes(session.description, query) && !session.tags.some((tag) => includes(tag, query))) continue;
    results.push({ id: `search-radio-${session.id}`, category: "Radio", label: session.title, detail: `${community.name} / ${session.status}`, communityId: community.id, channelId: session.channelId, radioSessionId: session.id });
  }

  for (const episode of audioDataSource.getSnapshot().podcastEpisodes) {
    if (episode.status !== "published") continue;
    const community = communities.find((item) => item.id === episode.communityId);
    if (!community) continue;
    const access = getCommunityAccess(currentUserId, community);
    if (!access.isMember && !access.canViewPublicContent) continue;
    if (!community.members.some((member) => member.userId === episode.authorUserId)) continue;
    const commentMatch = episode.commentPreview.some((comment) => includes(comment.body, query));
    if (query && !includes(episode.title, query) && !includes(episode.description, query) && !episode.tags.some((tag) => includes(tag, query)) && !commentMatch) continue;
    results.push({ id: `search-podcast-${episode.id}`, category: "Podcasts", label: episode.title, detail: `${community.name} / Podcast episode`, communityId: community.id, userId: episode.authorUserId, podcastEpisodeId: episode.id });
  }

  for (const mention of mentions) {
    const community = communities.find((item) => item.id === mention.communityId);
    if (!community) continue;
    const access = getCommunityAccess(currentUserId, community);
    const channel = community.categories.flatMap((category) => category.channels).find((item) => item.id === mention.channelId);
    if (!channel || !canViewChannel(access, channel)) continue;
    if (!query || includes(mention.body, query) || includes(mention.title, query)) results.push({ id: `search-mention-${mention.id}`, category: "Mentions", label: mention.title ?? mention.body.slice(0, 72), detail: community.name, communityId: community.id, channelId: mention.channelId, messageId: mention.messageId });
  }

  for (const saved of savedMessages) {
    const community = communities.find((item) => item.id === saved.communityId);
    if (!community || !saved.channelId) continue;
    const access = getCommunityAccess(currentUserId, community);
    const channel = community.categories.flatMap((category) => category.channels).find((item) => item.id === saved.channelId);
    if (!channel || !canViewChannel(access, channel) || (query && !includes(saved.preview, query))) continue;
    results.push({ id: `search-saved-${saved.id}`, category: "Saved", label: saved.preview?.slice(0, 72) || "Saved message", detail: community.name, communityId: community.id, channelId: saved.channelId, messageId: saved.messageId });
  }

  return rankSearchResults(results, query).slice(0, 80);
}

export function resolveMessageJumpTarget(result: AdvancedSearchResult, communities: Community[], currentUserId: string): MessageJumpResolution {
  if (!result.communityId || !result.channelId || !result.messageId) return { ok: false, reason: "This message is no longer available or you do not have access." };
  const community = communities.find((item) => item.id === result.communityId);
  if (!community) return { ok: false, reason: "This message is no longer available or you do not have access." };
  const access = getCommunityAccess(currentUserId, community);
  const channel = community.categories.flatMap((category) => category.channels).find((item) => item.id === result.channelId);
  if (!channel || !canViewChannel(access, channel)) return { ok: false, reason: "This message is no longer available or you do not have access." };
  const message = community.messages.find((item) => item.id === result.messageId && item.channelId === channel.id);
  if (!message || message.deletedAt) return { ok: false, reason: "This message is no longer available or you do not have access." };
  return { ok: true, community, channel, message };
}

export async function searchRemote(queryInput: string, category: RemoteSearchCategory | null = null, limit = 40): Promise<AdvancedSearchResult[]> {
  const query = safeQuery(queryInput);
  const client = getSupabaseClient();
  if (!client || query.length < 2) return [];
  const maxResults = Math.min(Math.max(limit, 1), 80);
  const customCategory = category === "radio_session" || category === "podcast_episode";
  const rpcCategory = customCategory ? null : category;
  const rpcResult = customCategory ? { data: [], error: null } : await client.rpc("search_accessible_entities", { query_text: query, category_filter: rpcCategory, result_limit: maxResults });
  const categoryMap: Record<Exclude<RemoteSearchCategory, "radio_session" | "podcast_episode">, AdvancedSearchCategory> = { community: "Communities", channel: "Channels", member: "People", message: "Messages", mention: "Mentions", saved_message: "Saved" };
  const results: AdvancedSearchResult[] = (rpcResult.error ? [] : (rpcResult.data ?? [])).map((row) => ({
    id: `remote-${row.result_type}-${row.entity_id}`,
    category: categoryMap[row.result_type as Exclude<RemoteSearchCategory, "radio_session" | "podcast_episode">],
    label: row.label,
    detail: row.detail,
    communityId: row.community_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    userId: row.user_id ?? undefined,
  }));
  if (category === null || category === "radio_session") {
    const radioResult = await client.from("radio_sessions").select("id,community_id,channel_id,title,description,status").in("status", ["scheduled", "live", "ended"]).or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(maxResults);
    if (!radioResult.error) for (const row of radioResult.data ?? []) results.push({ id: `remote-radio-${row.id}`, category: "Radio", label: row.title, detail: `Radio / ${row.status}`, communityId: row.community_id, channelId: row.channel_id ?? undefined, radioSessionId: row.id });
  }
  if (category === null || category === "podcast_episode") {
    const direct = await client.from("podcast_episodes").select("id,community_id,author_user_id,title,description,status").eq("status", "published").or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(maxResults);
    const comments = await client.from("podcast_episode_comments").select("episode_id").is("deleted_at", null).ilike("body", `%${query}%`).limit(maxResults);
    const commentEpisodeIds = [...new Set((comments.data ?? []).map((row) => row.episode_id))];
    const commentEpisodes = commentEpisodeIds.length ? await client.from("podcast_episodes").select("id,community_id,author_user_id,title,description,status").eq("status", "published").in("id", commentEpisodeIds).limit(maxResults) : { data: [], error: null };
    const seen = new Set(results.filter((item) => item.category === "Podcasts").map((item) => item.podcastEpisodeId));
    if (!direct.error && !commentEpisodes.error) for (const row of [...(direct.data ?? []), ...(commentEpisodes.data ?? [])]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      results.push({ id: `remote-podcast-${row.id}`, category: "Podcasts", label: row.title, detail: "Podcast episode", communityId: row.community_id, userId: row.author_user_id, podcastEpisodeId: row.id });
    }
  }
  return rankSearchResults(results, query).slice(0, maxResults);
}

export const searchMessages = (query: string) => searchRemote(query, "message", 30);
export const searchPeople = (query: string) => searchRemote(query, "member", 20);
export const searchChannels = (query: string) => searchRemote(query, "channel", 20);
export const searchCommunities = (query: string) => searchRemote(query, "community", 20);
export const searchMentions = (query: string) => searchRemote(query, "mention", 30);
export const searchSavedMessages = (query: string) => searchRemote(query, "saved_message", 30);
export const searchRadio = (query: string) => searchRemote(query, "radio_session", 30);
export const searchPodcasts = (query: string) => searchRemote(query, "podcast_episode", 30);

export const advancedSearchService = { searchLocal, searchRemote, searchMessages, searchPeople, searchChannels, searchCommunities, searchMentions, searchSavedMessages, searchRadio, searchPodcasts, resolveMessageJumpTarget };
