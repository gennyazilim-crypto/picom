import { mockAudioFeedItems } from "./mockAudio";
import { currentUserId } from "./mockCommunities";
import { mockMentionItems } from "./mockMentions";
import type { ContentMentionSourceType, UnifiedContentMention } from "../types/contentMentions";
import { textMentionToUnified } from "../types/contentMentions";

const visibility = {
  communityVisibility: "public" as const,
  channelPrivate: false,
  publicReadEnabled: true,
};

const textFixtures = mockMentionItems.slice(0, 4).map((item) =>
  textMentionToUnified(item, item.mentionedUserIds[0] ?? currentUserId),
);

const radio = mockAudioFeedItems.find((item) => item.type !== "podcast_episode");
const podcast = mockAudioFeedItems.find((item) => item.type === "podcast_episode");
const fallbackCommunityId = mockMentionItems[0]?.communityId ?? "community-orbit";
const fallbackAuthorId = mockMentionItems[0]?.authorId ?? "user-owner";
const now = new Date().toISOString();

function fixture(sourceType: ContentMentionSourceType, sourceId: string, preview: string, parentSourceId?: string): UnifiedContentMention {
  return {
    id: `unified-${sourceType}-${sourceId}`,
    sourceType,
    sourceId,
    parentSourceId,
    communityId: podcast?.communityId ?? radio?.communityId ?? fallbackCommunityId,
    channelId: sourceType === "radio_chat" ? mockMentionItems[0]?.channelId : undefined,
    authorId: podcast?.authorUserId ?? radio?.hostUserId ?? fallbackAuthorId,
    mentionedUserId: currentUserId,
    preview,
    createdAt: podcast?.createdAt ?? radio?.createdAt ?? now,
    updatedAt: podcast?.createdAt ?? radio?.createdAt ?? now,
    visibility,
  };
}

const radioId = radio?.sourceId ?? radio?.id.replace(/^feed-/, "") ?? "radio-session-mention";
const podcastId = podcast?.sourceId ?? podcast?.id.replace(/^feed-/, "") ?? "podcast-episode-mention";

export const mockUnifiedContentMentions: readonly UnifiedContentMention[] = [
  ...textFixtures,
  fixture("radio_session", radioId, `Live radio mention: ${radio?.title ?? "Community broadcast"}`),
  fixture("radio_chat", mockMentionItems[0]?.messageId ?? "radio-chat-message", "Listener chat mentioned you during the live show."),
  fixture("podcast_episode", podcastId, `Podcast description mention: ${podcast?.title ?? "Studio notes"}`),
  fixture("podcast_comment", "podcast-comment-mention", "A listener mentioned you in an episode comment.", podcastId),
].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
