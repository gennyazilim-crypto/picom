import type { SupabaseClient } from "@supabase/supabase-js";
import { mockCommunities } from "../data/mockCommunities";
import type { MessageSummary } from "./messageService";
import type { Database } from "./supabase/database.types";

export const MESSAGE_LIST_SELECT = "id, community_id, channel_id, author_id, body, client_message_id, created_at, edited_at, deleted_at" as const;

export type MessageListRow = Readonly<{
  id: string;
  community_id: string;
  channel_id: string;
  author_id: string;
  body: string;
  client_message_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}>;

export type ListMessagesInput = Readonly<{
  communityId: string;
  channelId: string;
  limit?: number;
  before?: string | null;
}>;

export type MessagePage = Readonly<{
  items: MessageSummary[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  limit: number;
}>;

export type MessageListQueryResult = Readonly<{
  data: MessagePage | null;
  error: unknown;
}>;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function normalizeMessagePageLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

export function mapMessageListRow(row: MessageListRow): MessageSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    channelId: row.channel_id,
    authorId: row.author_id,
    body: row.body,
    clientMessageId: row.client_message_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  };
}

function createPage(items: MessageSummary[], limit: number): MessagePage {
  const hasMore = items.length > limit;
  const pageItems = items.slice(0, limit).reverse();

  return {
    items: pageItems,
    nextCursor: hasMore ? items[limit - 1]?.createdAt ?? null : null,
    previousCursor: null,
    hasMore,
    limit,
  };
}

export function listMockMessageSummaries(input: ListMessagesInput): MessagePage {
  const limit = normalizeMessagePageLimit(input.limit);
  const community = mockCommunities.find((item) => item.id === input.communityId);
  const messages = (community?.messages ?? [])
    .filter((message) => message.channelId === input.channelId)
    .filter((message) => !input.before || message.createdAt < input.before)
    .map((message): MessageSummary => ({
      id: message.id,
      communityId: input.communityId,
      channelId: message.channelId,
      authorId: message.authorId,
      body: message.body,
      clientMessageId: null,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      deletedAt: null,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return createPage(messages, limit);
}

export async function listSupabaseMessageSummaries(client: SupabaseClient<Database>, input: ListMessagesInput): Promise<MessageListQueryResult> {
  const limit = normalizeMessagePageLimit(input.limit);
  let query = client
    .from("messages")
    .select(MESSAGE_LIST_SELECT)
    .eq("community_id", input.communityId)
    .eq("channel_id", input.channelId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (input.before) {
    query = query.lt("created_at", input.before);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error };
  }

  return {
    data: createPage((data ?? []).map(mapMessageListRow), limit),
    error: null,
  };
}
