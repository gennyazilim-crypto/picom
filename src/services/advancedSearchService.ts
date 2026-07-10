import type { Community } from "../types/community";
import type { MentionItem } from "../types/mentions";
import type { SavedMessageRecord } from "./savedMessageService";
import { canViewChannel, getCommunityAccess } from "./permissions/communityPermissions";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type AdvancedSearchCategory = "People" | "Communities" | "Channels" | "Messages" | "Mentions" | "Saved" | "Media";
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
}>;

export type RemoteSearchCategory = "community" | "channel" | "member" | "message" | "mention" | "saved_message";

function includes(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(query));
}

function safeQuery(query: string): string {
  return query.trim().replace(/[%_]/g, "").slice(0, 80);
}

export function searchLocal(queryInput: string, communities: Community[], mentions: MentionItem[], currentUserId: string, savedMessages: SavedMessageRecord[] = []): AdvancedSearchResult[] {
  const query = queryInput.trim().toLocaleLowerCase();
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
      if (!query || includes(message.body, query)) results.push({ id: `search-message-${message.id}`, category: "Messages", label: message.body.slice(0, 72) || "Message", detail: community.name, communityId: community.id, channelId: message.channelId, messageId: message.id });
      for (const attachment of message.attachments ?? []) if (!query || includes(attachment.alt, query)) results.push({ id: `search-media-${attachment.id}`, category: "Media", label: attachment.alt ?? "Shared image", detail: community.name, communityId: community.id, channelId: message.channelId, messageId: message.id, attachmentId: attachment.id });
    }
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

  return results.slice(0, 80);
}

export async function searchRemote(queryInput: string, category: RemoteSearchCategory | null = null, limit = 40): Promise<AdvancedSearchResult[]> {
  const query = safeQuery(queryInput);
  const client = getSupabaseClient();
  if (!client || query.length < 2) return [];
  const { data, error } = await client.rpc("search_accessible_entities", { query_text: query, category_filter: category, result_limit: Math.min(Math.max(limit, 1), 80) });
  if (error) return [];
  const categoryMap: Record<RemoteSearchCategory, AdvancedSearchCategory> = { community: "Communities", channel: "Channels", member: "People", message: "Messages", mention: "Mentions", saved_message: "Saved" };
  return (data ?? []).map((row) => ({
    id: `remote-${row.result_type}-${row.entity_id}`,
    category: categoryMap[row.result_type],
    label: row.label,
    detail: row.detail,
    communityId: row.community_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    userId: row.user_id ?? undefined,
  }));
}

export const searchMessages = (query: string) => searchRemote(query, "message", 30);
export const searchPeople = (query: string) => searchRemote(query, "member", 20);
export const searchChannels = (query: string) => searchRemote(query, "channel", 20);
export const searchCommunities = (query: string) => searchRemote(query, "community", 20);
export const searchMentions = (query: string) => searchRemote(query, "mention", 30);
export const searchSavedMessages = (query: string) => searchRemote(query, "saved_message", 30);

export const advancedSearchService = { searchLocal, searchRemote, searchMessages, searchPeople, searchChannels, searchCommunities, searchMentions, searchSavedMessages };

