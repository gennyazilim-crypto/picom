import type { Attachment, Reaction } from "../types/community";
import type { MentionCommentPreview, MentionItem } from "../types/mentions";
import type { Json } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";
import {
  applySignedUrlsToFeedAttachments,
  feedAttachmentToUiAttachment,
  mapRpcAttachments,
  type FeedAttachment,
} from "./feed/feedAttachmentModel";
import {
  collectPendingFeedStoragePaths,
  createSupabaseMessageAttachmentSigner,
  feedSignedUrlCache,
  signFeedAttachmentPaths,
} from "./feed/feedAttachmentSigning";

export type MentionFeedCursor = Readonly<{ createdAt: string; messageId: string }>;
export type MentionFeedPage = Readonly<{
  items: MentionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}>;
export type MentionFeedResult =
  | Readonly<{ ok: true; data: MentionFeedPage }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;

let listPageGeneration = 0;

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

function toUiAttachments(items: readonly FeedAttachment[]): Attachment[] {
  return items.flatMap((item) => {
    const ui = feedAttachmentToUiAttachment(item);
    return ui ? [ui] : [];
  });
}

/** Clear signed URL cache on logout / user switch / access revoke. */
export function resetMentionFeedAttachmentSigning(userId: string | null = null): void {
  feedSignedUrlCache.setUser(userId);
  if (!userId) feedSignedUrlCache.clear();
  listPageGeneration += 1;
}

export function invalidateMentionFeedAttachmentPath(storagePath: string): void {
  feedSignedUrlCache.invalidatePath(storagePath);
}

async function listPage(input: Readonly<{
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
  userId?: string | null;
}> = {}): Promise<MentionFeedResult> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 60);
  const cursor = decodeCursor(input.cursor);
  const generation = ++listPageGeneration;

  if (input.userId !== undefined) feedSignedUrlCache.setUser(input.userId ?? null);

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Mention Feed is unavailable until Picom reconnects." } };

  const { data, error } = await client.rpc("list_mention_feed", {
    cursor_created_at: cursor?.createdAt ?? null,
    cursor_message_id: cursor?.messageId ?? null,
    result_limit: limit + 1,
  });
  if (input.signal?.aborted || generation !== listPageGeneration) {
    return { ok: false, error: { code: "MENTION_FEED_ABORTED", message: "Mention Feed request was canceled." } };
  }
  if (error) return { ok: false, error: { code: "MENTION_FEED_LOAD_FAILED", message: "Picom could not load Mention Feed." } };

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  // Batch-sign once per page (dedupe paths; never log paths or URLs).
  const feedByMessage = new Map<string, FeedAttachment[]>();
  const pageAttachments: FeedAttachment[] = [];
  for (const row of pageRows) {
    const mapped = mapRpcAttachments(row.attachments, row.message_id);
    feedByMessage.set(row.message_id, mapped);
    pageAttachments.push(...mapped);
  }
  const pendingPaths = collectPendingFeedStoragePaths(pageAttachments);

  const signedByPath = new Map<string, string>();
  const toSign = feedSignedUrlCache.mergeCached(pendingPaths, signedByPath);
  if (toSign.length && !input.signal?.aborted && generation === listPageGeneration) {
    const minted = await signFeedAttachmentPaths(
      createSupabaseMessageAttachmentSigner(client),
      toSign,
      { signal: input.signal },
    );
    for (const [path, url] of minted) signedByPath.set(path, url);
    feedSignedUrlCache.applyKnown(minted);
  }

  if (input.signal?.aborted || generation !== listPageGeneration) {
    return { ok: false, error: { code: "MENTION_FEED_ABORTED", message: "Mention Feed request was canceled." } };
  }

  const items: MentionItem[] = pageRows.map((row) => ({
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
    attachments: toUiAttachments(applySignedUrlsToFeedAttachments(feedByMessage.get(row.message_id) ?? [], signedByPath)),
    reactions: mapReactions(row.reactions),
    viewCount: Math.max(0, Number(row.view_count) || 0),
    commentCount: Math.max(0, Number(row.comment_count) || 0),
    commenterIds: row.commenter_ids,
    commentPreview: mapCommentPreview(row.comment_preview),
    popularityScore: Math.max(0, Number(row.popularity_score) || 0),
    isUnread: row.is_unread,
    isSaved: row.is_saved,
  }));

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

export const mentionFeedService = { listPage, resetAttachmentSigning: resetMentionFeedAttachmentSigning, invalidateAttachmentPath: invalidateMentionFeedAttachmentPath };
