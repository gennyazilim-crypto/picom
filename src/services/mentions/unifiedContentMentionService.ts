import { mockUnifiedContentMentions } from "../../data/mockUnifiedContentMentions";
import type {
  ContentMentionSourceType,
  UnifiedContentMention,
  UnifiedContentMentionCursor,
} from "../../types/contentMentions";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type UnifiedMentionPage = Readonly<{
  items: readonly UnifiedContentMention[];
  nextCursor: UnifiedContentMentionCursor | null;
}>;

export type UnifiedMentionQuery = Readonly<{
  cursor?: UnifiedContentMentionCursor | null;
  limit?: number;
  sourceTypes?: readonly ContentMentionSourceType[];
  communityId?: string;
}>;

export type UnifiedMentionResult =
  | Readonly<{ ok: true; data: UnifiedMentionPage }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>;

type UnifiedMentionRow = Readonly<{
  id: string;
  source_type: ContentMentionSourceType;
  source_id: string;
  parent_source_id: string | null;
  community_id: string;
  channel_id: string | null;
  author_id: string;
  mentioned_user_id: string;
  preview: string;
  source_created_at: string;
  source_updated_at: string;
  visibility_context: unknown;
}>;

function limitFor(value?: number) {
  return Math.max(1, Math.min(50, Math.trunc(value ?? 30)));
}

function visibilityFrom(value: unknown): UnifiedContentMention["visibility"] {
  if (!value || typeof value !== "object") {
    return { communityVisibility: "unknown", channelPrivate: null, publicReadEnabled: false };
  }
  const row = value as Record<string, unknown>;
  return {
    communityVisibility: row.communityVisibility === "public" || row.communityVisibility === "private" ? row.communityVisibility : "unknown",
    channelPrivate: typeof row.channelPrivate === "boolean" ? row.channelPrivate : null,
    publicReadEnabled: row.publicReadEnabled === true,
  };
}

function mapRow(row: UnifiedMentionRow): UnifiedContentMention {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    parentSourceId: row.parent_source_id ?? undefined,
    communityId: row.community_id,
    channelId: row.channel_id ?? undefined,
    authorId: row.author_id,
    mentionedUserId: row.mentioned_user_id,
    preview: row.preview,
    createdAt: row.source_created_at,
    updatedAt: row.source_updated_at,
    visibility: visibilityFrom(row.visibility_context),
  };
}

function afterCursor(item: UnifiedContentMention, cursor: UnifiedContentMentionCursor) {
  return item.createdAt < cursor.createdAt || (item.createdAt === cursor.createdAt && item.id < cursor.id);
}

function mockPage(query: UnifiedMentionQuery): UnifiedMentionPage {
  const limit = limitFor(query.limit);
  const filtered = mockUnifiedContentMentions.filter((item) =>
    (!query.communityId || item.communityId === query.communityId)
    && (!query.sourceTypes?.length || query.sourceTypes.includes(item.sourceType))
    && (!query.cursor || afterCursor(item, query.cursor)),
  );
  const items = filtered.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: filtered.length > items.length && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export const unifiedContentMentionService = {
  async listPage(query: UnifiedMentionQuery = {}): Promise<UnifiedMentionResult> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: mockPage(query) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "MENTION_BACKEND_UNAVAILABLE", message: "Mentions are temporarily unavailable." } };

    const limit = limitFor(query.limit);
    const { data, error } = await client.rpc("list_unified_content_mentions", {
      cursor_created_at: query.cursor?.createdAt ?? null,
      cursor_mention_id: query.cursor?.id ?? null,
      source_types: query.sourceTypes?.length ? [...query.sourceTypes] : null,
      community_filter: query.communityId ?? null,
      result_limit: limit,
    });
    if (error) return { ok: false, error: { code: "MENTION_LOAD_FAILED", message: error.message } };
    const items = ((data ?? []) as UnifiedMentionRow[]).map(mapRow);
    const last = items[items.length - 1];
    return {
      ok: true,
      data: { items, nextCursor: items.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null },
    };
  },
};
