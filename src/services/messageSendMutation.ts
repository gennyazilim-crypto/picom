import type { SupabaseClient } from "@supabase/supabase-js";
import { currentUserId } from "../data/mockCommunities";
import type { MessageSummary, SendMessageInput } from "./messageService";
import type { Database } from "./supabase/database.types";

export const MESSAGE_SEND_SELECT = "id, community_id, channel_id, author_id, body, client_message_id, sequence, created_at, edited_at, deleted_at, reply_to_message_id, thread_id, webhook_id, webhook_name" as const;

export type MessageSendRow = Readonly<{
  id: string;
  community_id: string;
  channel_id: string;
  author_id: string;
  body: string;
  client_message_id: string | null;
  sequence: number | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  thread_id: string | null;
  webhook_id: string | null;
  webhook_name: string | null;
}>;

export type MessageSendMutationResult = Readonly<{
  data: MessageSummary | null;
  error: unknown;
}>;

export function mapMessageSendRow(row: MessageSendRow): MessageSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    channelId: row.channel_id,
    authorId: row.author_id,
    body: row.body,
    clientMessageId: row.client_message_id,
    sequence: row.sequence,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    replyToMessageId: row.reply_to_message_id,
    threadId: row.thread_id ?? null,
    webhookId: row.webhook_id ?? undefined,
    webhookName: row.webhook_name ?? undefined,
  };
}

export function createMockSentMessage(input: SendMessageInput, body: string): MessageSummary {
  const now = new Date().toISOString();
  const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: `mock-message-${idSuffix}`,
    communityId: input.communityId,
    channelId: input.channelId,
    authorId: input.authorId ?? currentUserId,
    body,
    clientMessageId: input.clientMessageId ?? null,
    sequence: null,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    replyToMessageId: input.replyToMessageId ?? null,
    threadId: input.threadId ?? null,
  };
}

export async function sendSupabaseMessage(
  client: SupabaseClient<Database>,
  input: SendMessageInput,
  body: string,
): Promise<MessageSendMutationResult> {
  const request = input.meetingRoomId
    ? client.rpc("send_meeting_chat_message", {
      target_room_id: input.meetingRoomId,
      target_session_id: input.meetingSessionId ?? null,
      message_body: body,
      target_client_message_id: input.clientMessageId ?? "",
      target_reply_to_message_id: input.replyToMessageId ?? null,
      target_attachment_ids: [...(input.attachmentIds ?? [])],
    })
    : client.rpc("send_text_message_idempotent", {
    target_community_id: input.communityId,
    target_channel_id: input.channelId,
    message_body: body,
    target_client_message_id: input.clientMessageId ?? "",
    target_reply_to_message_id: input.replyToMessageId ?? null,
    target_attachment_ids: [...(input.attachmentIds ?? [])],
  });
  const { data, error } = await request;
  const row = data?.[0] as MessageSendRow | undefined;

  if (error || !row) {
    return { data: null, error };
  }

  return {
    data: mapMessageSendRow(row),
    error: null,
  };
}
