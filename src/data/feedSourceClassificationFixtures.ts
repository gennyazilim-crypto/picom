import {
  classifyTextMessageContent,
  createFeedSourceReference,
  extractDirectMentionUserIds,
  type FeedClassifiableAttachment,
} from "../services/feed/feedSourceClassification";
import type { FeedContentKind, FeedSourceType } from "../types/feed";

const image: FeedClassifiableAttachment = {
  mimeType: "image/webp",
  validationStatus: "ready",
  scanStatus: "clean",
};

const video: FeedClassifiableAttachment = {
  mimeType: "video/mp4",
  validationStatus: "ready",
  scanStatus: "clean",
};

export const feedContentClassificationFixtures: readonly Readonly<{
  name: string;
  body?: string;
  attachments: readonly FeedClassifiableAttachment[];
  expected: FeedContentKind;
}>[] = [
  { name: "text only", body: "A real community update", attachments: [], expected: "text_only" },
  { name: "image only", attachments: [image, image], expected: "image_only" },
  { name: "text and image", body: "Gallery notes", attachments: [image], expected: "text_image" },
  { name: "video only", attachments: [video], expected: "video_only" },
  { name: "text and video", body: "Release demo", attachments: [video], expected: "text_video" },
  { name: "image and video", attachments: [image, video], expected: "image_video" },
  { name: "text image and video", body: "Full media recap", attachments: [image, video], expected: "text_image_video" },
];

export const feedSourceReferenceFixtures: readonly Readonly<{
  expected: FeedSourceType;
  input: Parameters<typeof createFeedSourceReference>[0];
}>[] = [
  { expected: "text_message", input: { type: "text_message", id: "message-1", communityId: "community-1", channelId: "channel-1" } },
  { expected: "radio_session", input: { type: "radio_session", id: "radio-1", communityId: "community-1", channelId: "channel-radio" } },
  { expected: "radio_comment", input: { type: "radio_chat", id: "radio-comment-1", parentId: "radio-1", communityId: "community-1", channelId: "channel-radio" } },
  { expected: "podcast_episode", input: { type: "podcast_episode", id: "episode-1", communityId: "community-2" } },
  { expected: "podcast_comment", input: { type: "podcast_comment", id: "podcast-comment-1", parentId: "episode-1", communityId: "community-2" } },
];

export function runFeedSourceClassificationFixtures(): readonly string[] {
  const failures: string[] = [];
  for (const fixture of feedContentClassificationFixtures) {
    const result = classifyTextMessageContent({ body: fixture.body, attachments: fixture.attachments });
    if (result?.kind !== fixture.expected) failures.push(`${fixture.name}: expected ${fixture.expected}, received ${result?.kind ?? "null"}`);
  }

  for (const fixture of feedSourceReferenceFixtures) {
    const result = createFeedSourceReference(fixture.input);
    if (result.type !== fixture.expected) failures.push(`source ${fixture.input.type}: expected ${fixture.expected}, received ${result.type}`);
  }

  const recipients = extractDirectMentionUserIds("author-1", ["user-1", "user-1", "author-1", null, "user-2"]);
  if (recipients.join(",") !== "user-1,user-2") failures.push("direct mention extraction did not deduplicate/exclude the author");

  const rejected = classifyTextMessageContent({
    body: "   ",
    attachments: [{ ...image, validationStatus: "failed" }, { ...video, visibility: "private" }],
  });
  if (rejected !== null) failures.push("failed/private attachments were classified as visible media");
  return failures;
}

