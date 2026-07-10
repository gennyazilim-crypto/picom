import type { SupabaseClient } from "@supabase/supabase-js";
import { dataSourceService } from "./dataSourceService";
import { createMockDeletedMessage, deleteSupabaseMessage, type DeletedMessageSummary } from "./messageDeleteMutation";
import { createMockEditedMessage, editSupabaseMessage, type EditedMessageSummary } from "./messageEditMutation";
import { listMockMessageSummaries, listSupabaseMessageSummaries, type ListMessagesInput, type MessagePage } from "./messageListQuery";
import { createMockSentMessage, sendSupabaseMessage } from "./messageSendMutation";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import type { Database } from "./supabase/database.types";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";

export const MESSAGE_SELECT = "id, community_id, channel_id, author_id, body, client_message_id, sequence, created_at, edited_at, deleted_at, reply_to_message_id, thread_id, webhook_id, webhook_name" as const;

export type MessageRow = Readonly<{
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
  thread_id?: string | null;
  webhook_id?: string | null;
  webhook_name?: string | null;
}>;

export type MessageSummary = Readonly<{
  id: string;
  communityId: string;
  channelId: string;
  authorId: string;
  body: string;
  clientMessageId: string | null;
  sequence: number | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  webhookId?: string;
  webhookName?: string;
}>;

export type SendMessageInput = Readonly<{
  communityId: string;
  channelId: string;
  body: string;
  authorId?: string;
  clientMessageId?: string | null;
  replyToMessageId?: string | null;
}>;

export type EditMessageInput = Readonly<{
  messageId: string;
  body: string;
}>;

export type DeleteMessageInput = Readonly<{
  messageId: string;
}>;

export type MessageServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "QUEUE_FULL"
  | "QUEUE_CANCELED"
  | "MESSAGE_SEND_FAILED"
  | "MESSAGE_LIST_FAILED"
  | "MESSAGE_EDIT_FAILED"
  | "MESSAGE_DELETE_FAILED";

export type MessageServiceError = Readonly<{
  code: MessageServiceErrorCode;
  message: string;
}>;

export type MessageServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: MessageServiceError }>;

export function mapMessageRow(row: MessageRow): MessageSummary {
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
    webhookId: row.webhook_id ?? undefined,
    webhookName: row.webhook_name ?? undefined,
  };
}

function messageError(code: MessageServiceErrorCode, message: string): MessageServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return messageError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return messageError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

function validateSendMessageInput(input: SendMessageInput): MessageServiceError | null {
  if (!input.communityId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  }

  if (!input.channelId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Channel ID is required." };
  }

  if (!input.body.trim()) {
    return { code: "VALIDATION_ERROR", message: "Message body is required." };
  }

  if (input.body.length > 4000) {
    return { code: "VALIDATION_ERROR", message: "Message must be 4000 characters or fewer." };
  }

  return null;
}

function validateListMessagesInput(input: ListMessagesInput): MessageServiceError | null {
  if (!input.communityId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  }

  if (!input.channelId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Channel ID is required." };
  }

  return null;
}

function validateEditMessageInput(input: EditMessageInput): MessageServiceError | null {
  if (!input.messageId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Message ID is required." };
  }

  if (!input.body.trim()) {
    return { code: "VALIDATION_ERROR", message: "Message body is required." };
  }

  if (input.body.length > 4000) {
    return { code: "VALIDATION_ERROR", message: "Message must be 4000 characters or fewer." };
  }

  return null;
}

function validateDeleteMessageInput(input: DeleteMessageInput): MessageServiceError | null {
  if (!input.messageId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Message ID is required." };
  }

  return null;
}

async function getSupabaseAuthorId(client: SupabaseClient<Database>, explicitAuthorId?: string): Promise<MessageServiceResult<string>> {
  if (explicitAuthorId?.trim()) {
    return { ok: true, data: explicitAuthorId.trim() };
  }

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return messageError("AUTH_REQUIRED", "Sign in before sending messages.");
  }

  return { ok: true, data: data.user.id };
}

export const messageService = {
  async listMessages(input: ListMessagesInput): Promise<MessageServiceResult<MessagePage>> {
    const validationError = validateListMessagesInput(input);
    if (validationError) return { ok: false, error: validationError };

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: listMockMessageSummaries(input) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const result = await listSupabaseMessageSummaries(configured.data, input);

    if (result.error || !result.data) {
      return messageError("MESSAGE_LIST_FAILED", "Could not load messages.");
    }

    return { ok: true, data: result.data };
  },

  async sendMessage(input: SendMessageInput): Promise<MessageServiceResult<MessageSummary>> {
    const validationError = validateSendMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const body = input.body.trim();
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: createMockSentMessage(input, body) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const author = await getSupabaseAuthorId(configured.data, input.authorId);
    if (!author.ok) return author;

    const { data, error } = await sendSupabaseMessage(configured.data, input, author.data, body);

    if (error || !data) {
      if (isRateLimitError(error)) return messageError("RATE_LIMITED", rateLimitUserMessage);
      return messageError("MESSAGE_SEND_FAILED", "Could not send message.");
    }

    return { ok: true, data };
  },

  async editMessage(input: EditMessageInput): Promise<MessageServiceResult<EditedMessageSummary>> {
    const validationError = validateEditMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const body = input.body.trim();
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: createMockEditedMessage(input.messageId, body) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await editSupabaseMessage(configured.data, input.messageId, body);

    if (error || !data) {
      return messageError("MESSAGE_EDIT_FAILED", "Could not edit message.");
    }

    return { ok: true, data };
  },

  async deleteMessage(input: DeleteMessageInput): Promise<MessageServiceResult<DeletedMessageSummary>> {
    const validationError = validateDeleteMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: createMockDeletedMessage(input.messageId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await deleteSupabaseMessage(configured.data, input.messageId);

    if (error || !data) {
      return messageError("MESSAGE_DELETE_FAILED", "Could not delete message.");
    }

    return { ok: true, data };
  },
};
