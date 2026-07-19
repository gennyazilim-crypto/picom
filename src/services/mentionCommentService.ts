import type { MentionCommentPreview, MentionItem } from "../types/mentions";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { threadService } from "./threadService";

const MOCK_COMMENT_BODIES = [
  "This footer pattern feels much easier to scan.",
  "The avatar stack gives the card more life without adding noise.",
  "Keep the stats compact and it will fit both themes.",
  "Emoji-only reactions are the right call here.",
  "Nice, this still feels desktop-native.",
  "The spacing between actions feels much clearer now.",
  "This reads well in both light and dark themes.",
  "The mention card hierarchy is easier to parse at a glance.",
  "Compact metadata chips help without crowding the header.",
  "Opening the thread from here should stay one click away.",
] as const;

function buildMockExpandedComments(item: MentionItem): MentionCommentPreview[] {
  const preview = item.commentPreview ?? [];
  const targetCount = Math.max(item.commentCount ?? preview.length, preview.length);
  if (targetCount <= preview.length) return preview;

  const commenterIds = item.commenterIds?.length
    ? item.commenterIds
    : preview.map((comment) => comment.authorId);
  if (!commenterIds.length) return preview;

  const existingIds = new Set(preview.map((comment) => comment.id));
  const baseTime = Date.parse(item.createdAt);
  const expanded = [...preview];

  for (let index = preview.length; index < targetCount; index += 1) {
    const authorId = commenterIds[index % commenterIds.length];
    const id = `mention-comment-${item.messageId}-${index + 1}`;
    if (existingIds.has(id)) continue;

    expanded.push({
      id,
      authorId,
      body: MOCK_COMMENT_BODIES[index % MOCK_COMMENT_BODIES.length],
      createdAt: new Date(baseTime + (index + 1) * 60_000).toISOString(),
    });
    existingIds.add(id);
  }

  return expanded;
}

async function listSupabaseComments(item: MentionItem): Promise<MentionCommentPreview[]> {
  const client = getSupabaseClient();
  if (!client) return item.commentPreview ?? [];

  const { data: threads, error: threadError } = await client
    .from("threads")
    .select("id")
    .eq("parent_message_id", item.messageId)
    .limit(1);

  if (threadError || !threads?.length) return item.commentPreview ?? [];

  const result = await threadService.listMessages(threads[0].id);
  if (!result.ok || !result.data.length) return item.commentPreview ?? [];

  return result.data.map((message) => ({
    id: message.id,
    authorId: message.authorId,
    body: message.body.slice(0, 180),
    createdAt: message.createdAt,
  }));
}

export async function listMentionComments(item: MentionItem): Promise<MentionCommentPreview[]> {
  if (dataSourceService.getStatus().isMock) {
    return buildMockExpandedComments(item);
  }

  return listSupabaseComments(item);
}
