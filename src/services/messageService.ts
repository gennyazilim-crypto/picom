import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteSupabaseMessage, type DeletedMessageSummary } from "./messageDeleteMutation";
import { editSupabaseMessage, type EditedMessageSummary } from "./messageEditMutation";
import { listSupabaseMessageSummaries, type ListMessagesInput, type MessagePage } from "./messageListQuery";
import { sendSupabaseMessage } from "./messageSendMutation";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import type { Database } from "./supabase/database.types";
import { loggingService } from "./loggingService";
import {
  classifyMessageSendError,
  executeMessageSendWithRetry,
  toMessageSendLogMetadata,
  type MessageSendContext,
  type MessageSendError,
} from "./messageSendObservability";
import { reactionService } from "./reactionService";
import type { Reaction } from "../types/community";

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
  threadId?: string | null;
  reactions?: Reaction[];
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
  attachmentIds?: readonly string[];
  threadId?: string | null;
  meetingRoomId?: string;
  meetingSessionId?: string | null;
}>;

export type EditMessageInput = Readonly<{
  messageId: string;
  body: string;
  expectedEditedAt?: string | null;
}>;

export type DeleteMessageInput = Readonly<{
  messageId: string;
  expectedEditedAt?: string | null;
}>;

export type MessageServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "QUEUE_FULL"
  | "QUEUE_CANCELED"
  | "MESSAGE_SEND_FAILED"
  | "MESSAGE_SEND_FORBIDDEN"
  | "MESSAGE_SEND_CONFLICT"
  | "MESSAGE_SEND_EMPTY_RESPONSE"
  | "MESSAGE_LIST_FAILED"
  | "MESSAGE_EDIT_FAILED"
  | "MESSAGE_EDIT_CONFLICT"
  | "MESSAGE_DELETED_CONFLICT"
  | "MESSAGE_DELETE_FAILED"
  | "MESSAGE_DELETE_CONFLICT";

type LegacyMessageServiceError = Readonly<{
  code: MessageServiceErrorCode;
  message: string;
}>;

export type MessageServiceError = LegacyMessageServiceError | MessageSendError;

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
    threadId: row.thread_id ?? null,
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

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 4 || attachmentIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))) {
    return { code: "VALIDATION_ERROR", message: "A message can include up to four valid attachments." };
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

async function ensureSendAuthSession(client: SupabaseClient<Database>): Promise<MessageServiceResult<string>> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return messageError("AUTH_REQUIRED", "Sign in before sending messages.");
  }

  const expiresAtMs = (sessionData.session.expires_at ?? 0) * 1000;
  if (expiresAtMs && expiresAtMs - Date.now() < 120_000) {
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token || !refreshed.session.user) {
      return messageError("AUTH_REQUIRED", "Your session expired. Sign in again before sending messages.");
    }
    return { ok: true, data: refreshed.session.user.id };
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return messageError("AUTH_REQUIRED", "Sign in before sending messages.");
  }

  return { ok: true, data: data.user.id };
}

function ensureClientMessageId(value?: string | null): string {
  const normalized = value?.trim();
  if (normalized) return normalized;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function reconcileCommunityMessage(
  client: SupabaseClient<Database>,
  input: SendMessageInput,
  actorId: string,
): Promise<MessageSummary | null> {
  if (!input.clientMessageId) return null;
  const result = await client
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("community_id", input.communityId)
    .eq("channel_id", input.channelId)
    .eq("author_id", actorId)
    .eq("client_message_id", input.clientMessageId)
    .maybeSingle();
  return result.error || !result.data ? null : mapMessageRow(result.data);
}

export const messageService = {
  async listMessages(input: ListMessagesInput): Promise<MessageServiceResult<MessagePage>> {
    const validationError = validateListMessagesInput(input);
    if (validationError) return { ok: false, error: validationError };

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const result = await listSupabaseMessageSummaries(configured.data, input);

    if (result.error || !result.data) {
      return messageError("MESSAGE_LIST_FAILED", "Could not load messages.");
    }

    const reactionResult = await reactionService.listSummaries(result.data.items.map((message) => message.id));
    if (!reactionResult.ok) return { ok: true, data: result.data };
    const byMessage = new Map<string, Reaction[]>();
    for (const summary of reactionResult.data) {
      const reactions = byMessage.get(summary.messageId) ?? [];
      reactions.push({ emoji: summary.emoji, count: summary.count, reactedByCurrentUser: summary.reactedByCurrentUser });
      byMessage.set(summary.messageId, reactions);
    }
    return {
      ok: true,
      data: { ...result.data, items: result.data.items.map((message) => ({ ...message, reactions: byMessage.get(message.id) ?? [] })) },
    };
  },

  async sendMessage(input: SendMessageInput): Promise<MessageServiceResult<MessageSummary>> {
    const validationError = validateSendMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const body = input.body.trim();
    const normalizedInput: SendMessageInput = { ...input, clientMessageId: ensureClientMessageId(input.clientMessageId) };
    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const author = await ensureSendAuthSession(configured.data);
    if (!author.ok) return author;

    const context: MessageSendContext = {
      operation: "community_message",
      correlationId: normalizedInput.clientMessageId ?? crypto.randomUUID(),
      actorId: author.data,
      communityId: normalizedInput.communityId,
      channelId: normalizedInput.channelId,
      clientMessageId: normalizedInput.clientMessageId ?? undefined,
    };
    const execution = await executeMessageSendWithRetry({
      client: configured.data,
      context,
      operation: () => sendSupabaseMessage(configured.data, normalizedInput, body),
      onAttempt: (event) => {
        const metadata = toMessageSendLogMetadata(context, event);
        if (event.outcome === "failure") loggingService.logWarn("Community message send attempt failed", metadata, "message-send");
        else loggingService.logInfo("Community message send attempt completed", metadata, "message-send");
      },
    });
    const { data, error } = execution.result;

    if (error) {
      const classified = execution.error ?? classifyMessageSendError(error, context);
      if (classified.category === "conflict") {
        const canonical = await reconcileCommunityMessage(configured.data, normalizedInput, author.data);
        if (canonical) {
          loggingService.logInfo("Community message send reconciled after conflict", {
            ...toMessageSendLogMetadata(context, {
              attemptNumber: execution.attemptCount,
              outcome: "success",
              durationMs: 0,
              sessionRefreshAttempted: execution.sessionRefreshAttempted,
            }),
            server_message_id: canonical.id,
          }, "message-send");
          return { ok: true, data: canonical };
        }
      }
      return { ok: false, error: classified };
    }
    if (!data) {
      const emptyResponse = classifyMessageSendError(
        { code: "MESSAGE_SEND_EMPTY_RESPONSE", message: "The send RPC returned no canonical message." },
        context,
      );
      loggingService.logWarn("Community message send returned empty response", {
        ...toMessageSendLogMetadata(context, {
          attemptNumber: execution.attemptCount,
          outcome: "failure",
          durationMs: 0,
          sessionRefreshAttempted: execution.sessionRefreshAttempted,
          error: emptyResponse,
        }),
      }, "message-send");
      return { ok: false, error: { ...emptyResponse, category: "server", retryable: true, userMessage: "The message could not be confirmed. Retry once.", message: "The message could not be confirmed. Retry once." } };
    }

    return { ok: true, data };
  },

  async editMessage(input: EditMessageInput): Promise<MessageServiceResult<EditedMessageSummary>> {
    const validationError = validateEditMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const body = input.body.trim();
    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error, conflict } = await editSupabaseMessage(configured.data, input.messageId, body, input.expectedEditedAt);

    if (error || !data) {
      if (conflict === "version") return messageError("MESSAGE_EDIT_CONFLICT", "This message changed in another window. Review your draft and retry.");
      if (conflict === "deleted") return messageError("MESSAGE_DELETED_CONFLICT", "This message was deleted in another window.");
      return messageError("MESSAGE_EDIT_FAILED", "Could not edit message.");
    }

    return { ok: true, data };
  },

  async deleteMessage(input: DeleteMessageInput): Promise<MessageServiceResult<DeletedMessageSummary>> {
    const validationError = validateDeleteMessageInput(input);
    if (validationError) return { ok: false, error: validationError };

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error, conflict } = await deleteSupabaseMessage(configured.data, input.messageId, input.expectedEditedAt);

    if (error || !data) {
      if (conflict === "version") return messageError("MESSAGE_DELETE_CONFLICT", "This message changed in another window. Review it before deleting.");
      return messageError("MESSAGE_DELETE_FAILED", "Could not delete message.");
    }

    return { ok: true, data };
  },
};
