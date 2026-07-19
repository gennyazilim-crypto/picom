import type { Attachment, AttachmentScanStatus, Reaction } from "../types/community";
import type { MentionCommentPreview, MentionItem } from "../types/mentions";
import { dataSourceService } from "./dataSourceService";
import type { Database, Json } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";

type MentionFeedRow = Database["public"]["Views"]["mention_feed_view"]["Row"];

export type MentionFeedCursor = Readonly<{ createdAt: string; messageId: string }>;
export type MentionFeedPage = Readonly<{
  items: MentionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}>;
export type MentionFeedResult =
  | Readonly<{ ok: true; data: MentionFeedPage }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;

function encodeCursor(cursor: MentionFeedCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

function decodeCursor(value?: string | null): MentionFeedCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<MentionFeedCursor>;
    if (typeof parsed.createdAt === "string" && typeof parsed.messageId === "string") {
      return { createdAt: parsed.createdAt, messageId: parsed.messageId };
    }
  } catch {
    // Invalid cursors fail closed to the first page.
  }
  return null;
}

function objectArray(value: Json): Array<Record<string, Json | undefined>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, Json | undefined> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function stringValue(value: Json | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: Json | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapAttachments(value: Json): Attachment[] {
  return objectArray(value).flatMap((row) => {
    const id = stringValue(row.id);
    const publicUrl = stringValue(row.public_url);
    if (!id || !publicUrl) return [];
    const scanStatus = stringValue(row.scan_status);
    if (scanStatus !== "clean" && scanStatus !== "skipped_development") return [];
    const thumbnailUrl = stringValue(row.thumbnail_url);
    return [{
      id,
      type: "image" as const,
      url: publicUrl,
      publicUrl,
      thumbnailUrl: thumbnailUrl ?? publicUrl,
      mimeType: stringValue(row.mime_type),
      alt: stringValue(row.file_name) ?? "Shared image",
      width: numberValue(row.width),
      height: numberValue(row.height),
      scanStatus: scanStatus as AttachmentScanStatus,
    }];
  });
}

function mapReactions(value: Json): Reaction[] {
  return objectArray(value).flatMap((row) => {
    const emoji = stringValue(row.emoji);
    const count = numberValue(row.count);
    if (!emoji || count === undefined) return [];
    return [{ emoji, count: Math.max(0, count), reactedByCurrentUser: row.reacted_by_current_user === true }];
  }).filter((reaction) => reaction.count > 0).sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji)).slice(0, 4);
}

function mapCommentPreview(value: Json): MentionCommentPreview[] {
  return objectArray(value).flatMap((row) => {
    const id = stringValue(row.id);
    const authorId = stringValue(row.author_id);
    const body = stringValue(row.body);
    const createdAt = stringValue(row.created_at);
    if (!id || !authorId || !body || !createdAt) return [];
    return [{ id, authorId, body: body.slice(0, 180), createdAt }];
  }).slice(0, 2);
}

function mapRow(row: MentionFeedRow): MentionItem {
  return {
    id: `mention-${row.message_id}`,
    source: row.source === "following" ? "following" : "popular_feed",
    communityId: row.community_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    authorId: row.author_id,
    mentionedUserIds: row.mentioned_user_ids,
    body: row.body,
    title: row.title ?? undefined,
    createdAt: row.created_at,
    attachments: mapAttachments(row.attachments),
    reactions: mapReactions(row.reactions),
    viewCount: Math.max(0, Number(row.view_count) || 0),
    commentCount: Math.max(0, Number(row.comment_count) || 0),
    commenterIds: row.commenter_ids,
    commentPreview: mapCommentPreview(row.comment_preview),
    popularityScore: Math.max(0, Number(row.popularity_score) || 0),
    isUnread: row.is_unread,
    isSaved: row.is_saved,
  };
}

async function listPage(input: Readonly<{ cursor?: string | null; limit?: number }> = {}): Promise<MentionFeedResult> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 60);
  const cursor = decodeCursor(input.cursor);

  if (dataSourceService.getStatus().isMock) {
    const { mockMentionItems } = await import("../data/mockMentions");
    const ordered = [...mockMentionItems].sort((left, right) => {
      const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return createdDelta || right.messageId.localeCompare(left.messageId);
    });
    const start = cursor
      ? Math.max(0, ordered.findIndex((item) => item.createdAt === cursor.createdAt && item.messageId === cursor.messageId) + 1)
      : 0;
    const pageItems = ordered.slice(start, start + limit);
    const hasMore = start + limit < ordered.length;
    const last = pageItems[pageItems.length - 1];
    return { ok: true, data: { items: pageItems, hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, messageId: last.messageId }) : null } };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Mention Feed is unavailable until Picom reconnects." } };

  const { data, error } = await client.rpc("list_mention_feed", {
    cursor_created_at: cursor?.createdAt ?? null,
    cursor_message_id: cursor?.messageId ?? null,
    result_limit: limit + 1,
  });
  if (error) return { ok: false, error: { code: "MENTION_FEED_LOAD_FAILED", message: "Picom could not load Mention Feed." } };

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(mapRow);
  const last = pageRows[pageRows.length - 1];
  return {
    ok: true,
    data: {
      items,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.created_at, messageId: last.message_id }) : null,
    },
  };
}

export const mentionFeedService = { listPage };
