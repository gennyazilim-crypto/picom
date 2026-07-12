import type {
  FeedContentKind,
  FeedSourceReference,
  FeedSourceType,
} from "../../types/feed";

export type FeedClassifiableAttachment = Readonly<{
  mimeType: string;
  validationStatus: "ready" | "pending" | "failed" | "deleted" | "quarantined";
  scanStatus: "clean" | "skipped_development" | "pending" | "suspicious" | "failed";
  visibility?: "visible" | "private";
  deletedAt?: string | null;
}>;

export type FeedContentClassification = Readonly<{
  kind: FeedContentKind;
  hasText: boolean;
  hasImage: boolean;
  hasVideo: boolean;
}>;

export type FeedSourceReferenceInput = Readonly<{
  type: FeedSourceType | "radio_chat";
  id: string;
  parentId?: string;
  communityId?: string;
  channelId?: string;
}>;

const MEDIA_SCAN_STATUSES = new Set<FeedClassifiableAttachment["scanStatus"]>([
  "clean",
  "skipped_development",
]);

export function normalizeFeedText(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function canonicalizeFeedSourceType(type: FeedSourceType | "radio_chat"): FeedSourceType {
  return type === "radio_chat" ? "radio_comment" : type;
}

function attachmentMediaType(attachment: FeedClassifiableAttachment): "image" | "video" | null {
  if (
    attachment.validationStatus !== "ready"
    || !MEDIA_SCAN_STATUSES.has(attachment.scanStatus)
    || attachment.visibility === "private"
    || Boolean(attachment.deletedAt)
  ) return null;

  const mimeType = attachment.mimeType.trim().toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export function classifyTextMessageContent(input: Readonly<{
  body?: string | null;
  attachments?: readonly FeedClassifiableAttachment[];
}>): FeedContentClassification | null {
  const hasText = normalizeFeedText(input.body).length > 0;
  let hasImage = false;
  let hasVideo = false;

  for (const attachment of input.attachments ?? []) {
    const mediaType = attachmentMediaType(attachment);
    if (mediaType === "image") hasImage = true;
    if (mediaType === "video") hasVideo = true;
  }

  let kind: FeedContentKind | null = null;
  if (hasText && hasImage && hasVideo) kind = "text_image_video";
  else if (hasImage && hasVideo) kind = "image_video";
  else if (hasText && hasVideo) kind = "text_video";
  else if (hasText && hasImage) kind = "text_image";
  else if (hasVideo) kind = "video_only";
  else if (hasImage) kind = "image_only";
  else if (hasText) kind = "text_only";

  return kind ? { kind, hasText, hasImage, hasVideo } : null;
}

export function extractDirectMentionUserIds(
  authorId: string,
  mentionedUserIds: readonly (string | null | undefined)[],
): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of mentionedUserIds) {
    const userId = value?.trim();
    if (!userId || userId === authorId || seen.has(userId)) continue;
    seen.add(userId);
    result.push(userId);
  }
  return result;
}

export function createFeedSourceReference(input: FeedSourceReferenceInput): FeedSourceReference {
  const type = canonicalizeFeedSourceType(input.type);
  if (!input.id.trim()) throw new Error("FEED_SOURCE_ID_REQUIRED");

  if (type === "text_message") {
    if (!input.communityId || !input.channelId) throw new Error("FEED_MESSAGE_DEEP_LINK_REQUIRED");
    return {
      type,
      id: input.id,
      communityId: input.communityId,
      channelId: input.channelId,
      deepLink: { view: "community", communityId: input.communityId, channelId: input.channelId, messageId: input.id },
    };
  }

  if (type === "radio_session" || type === "radio_comment") {
    const radioSessionId = type === "radio_session" ? input.id : input.parentId;
    if (!radioSessionId) throw new Error("FEED_RADIO_PARENT_REQUIRED");
    return {
      type,
      id: input.id,
      parentId: input.parentId,
      communityId: input.communityId,
      channelId: input.channelId,
      deepLink: {
        view: "radio",
        communityId: input.communityId,
        channelId: input.channelId,
        radioSessionId,
        ...(type === "radio_comment" ? { commentId: input.id } : {}),
      },
    };
  }

  const podcastEpisodeId = type === "podcast_episode" ? input.id : input.parentId;
  if (!podcastEpisodeId) throw new Error("FEED_PODCAST_PARENT_REQUIRED");
  return {
    type,
    id: input.id,
    parentId: input.parentId,
    communityId: input.communityId,
    deepLink: {
      view: "podcast",
      communityId: input.communityId,
      podcastEpisodeId,
      ...(type === "podcast_comment" ? { commentId: input.id } : {}),
    },
  };
}

