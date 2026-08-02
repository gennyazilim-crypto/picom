import { directAttachmentTypeFromMime, type DirectConversation, type DirectMessage, type DirectMessageAttachment, type DirectMessageCursor, type DirectMessagePage, type DirectSharedMediaPage } from "../../types/directMessages";
import { displayUrlForDirectAttachment, resolveDirectAttachmentStoragePath, signDirectAttachmentPaths } from "../directMessages/directAttachmentUploadService";
import { loggingService } from "../loggingService";
import {
  classifyMessageSendError,
  executeMessageSendWithRetry,
  toMessageSendLogMetadata,
  type MessageSendContext,
  type MessageSendError,
} from "../messageSendObservability";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabaseClient";
import type { Database } from "./database.types";

type MessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
type DirectMessageErrorCode = "NOT_CONFIGURED" | "AUTH_REQUIRED" | "VALIDATION_ERROR" | "REQUEST_FAILED" | "PERMISSION_DENIED" | "IDEMPOTENCY_CONFLICT";
type LegacyDirectMessageError = Readonly<{ code: DirectMessageErrorCode; message: string }>;
export type DirectMessageServiceResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: LegacyDirectMessageError | MessageSendError }>;
export type SendDirectMessageInput = Readonly<{ conversationId: string; body: string; clientMessageId?: string; replyToMessageId?: string; attachments?: readonly DirectMessageAttachment[] }>;
export type DirectMessagePageOptions = Readonly<{ limit?: number; before?: DirectMessageCursor }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(code: DirectMessageErrorCode, message: string): DirectMessageServiceResult<never> { return { ok: false, error: { code, message } }; }
function configuredClient() { const status = getSupabaseClientStatus(); const client = getSupabaseClient(); if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured."); return { ok: true as const, data: client }; }
async function currentUserId(): Promise<DirectMessageServiceResult<string>> { const configured = configuredClient(); if (!configured.ok) return configured; const { data, error } = await configured.data.auth.getUser(); if (error || !data.user) return failure("AUTH_REQUIRED", "Sign in to use direct messages."); return { ok: true, data: data.user.id }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isMessageRow(value: unknown): value is MessageRow {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.conversation_id === "string"
    && typeof value.author_id === "string"
    && typeof value.created_at === "string"
    && (typeof value.body === "string" || value.body === null);
}
function mapMessage(row: MessageRow): DirectMessage { return { id: row.id, conversationId: row.conversation_id, authorId: row.author_id, body: row.body ?? "", clientMessageId: row.client_message_id ?? undefined, replyToMessageId: row.reply_to_message_id ?? undefined, createdAt: row.created_at, editedAt: row.edited_at ?? undefined, deletedAt: row.deleted_at ?? undefined }; }
function normalizeLimit(value: number | undefined, fallback = 50): number { return Math.max(1, Math.min(Math.floor(value ?? fallback), 100)); }
function isConversationUuid(value: string): boolean { return UUID_PATTERN.test(value.trim()); }

export async function getDirectMessagesPage(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectMessagePage>> {
  const trimmedId = conversationId.trim();
  if (!trimmedId) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  // Mock / local ids (e.g. "dm-naines") must not hit PostgREST uuid filters.
  if (!isConversationUuid(trimmedId)) return { ok: true, data: { items: [], hasMore: false } };
  const configured = configuredClient(); if (!configured.ok) return configured;
  const limit = normalizeLimit(options.limit);
  const rpc = await configured.data.rpc("list_direct_messages", {
    target_conversation_id: trimmedId,
    before_created_at: options.before?.createdAt ?? null,
    before_message_id: options.before?.id ?? null,
    result_limit: limit + 1,
  });
  let rows: MessageRow[] | null = null;
  if (!rpc.error && Array.isArray(rpc.data)) {
    rows = rpc.data as MessageRow[];
  } else {
    // Fallback for environments that have not applied list_direct_messages yet.
    const rpcMissing = Boolean(rpc.error?.message?.includes("list_direct_messages") || rpc.error?.code === "PGRST202");
    if (!rpcMissing && rpc.error) return failure("REQUEST_FAILED", "Could not load direct messages.");
    let query = configured.data.from("direct_messages").select("id,conversation_id,author_id,body,reply_to_message_id,client_message_id,created_at,updated_at,edited_at,deleted_at").eq("conversation_id", trimmedId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (options.before) query = query.or(`created_at.lt.${options.before.createdAt},and(created_at.eq.${options.before.createdAt},id.lt.${options.before.id})`);
    const { data, error } = await query;
    if (error) return failure("REQUEST_FAILED", "Could not load direct messages.");
    rows = (data ?? []) as MessageRow[];
  }
  const descending = (rows ?? []).map((row) => mapMessage(row));
  const hasMore = descending.length > limit;
  const items = descending.slice(0, limit).reverse();
  const oldest = items[0];
  return { ok: true, data: { items, hasMore, nextCursor: hasMore && oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined } };
}

export async function getDirectMessages(conversationId: string): Promise<DirectMessageServiceResult<DirectMessage[]>> {
  const page = await getDirectMessagesPage(conversationId, { limit: 100 });
  return page.ok ? { ok: true, data: page.data.items } : page;
}

export async function loadDirectConversations(): Promise<DirectMessageServiceResult<DirectConversation[]>> {
  const configured = configuredClient(); if (!configured.ok) return configured;
  const user = await currentUserId(); if (!user.ok) return user;
  const result = await configured.data.rpc("list_direct_conversations", { result_limit: 50 });
  if (result.error) return failure("REQUEST_FAILED", "Could not load direct conversations.");
  const ids = (result.data ?? []).map((row) => row.id);
  const preferences = ids.length ? await configured.data.from("direct_conversation_participants").select("conversation_id,last_read_at,last_read_message_id,muted_until,archived_at").eq("user_id", user.data).in("conversation_id", ids) : { data: [], error: null };
  const preferenceRows = preferences.error ? [] : preferences.data ?? [];
  const preferenceByConversation = new Map(preferenceRows.map((row) => [row.conversation_id, row]));
  const conversations = (result.data ?? []).map((row) => {
    const preference = preferenceByConversation.get(row.id);
    const participantStatus = row.participant_status === "offline" || row.participant_status === "idle" || row.participant_status === "dnd" ? row.participant_status : row.participant_status === "busy" ? "dnd" : "online";
    const mutedUntil = preference?.muted_until ?? undefined;
    return { id: row.id, participantUserId: row.participant_user_id, participantName: row.participant_name, participantUsername: row.participant_username, participantStatus, participantStatusText: row.participant_status_text, lastMessagePreview: row.last_message_preview, updatedAt: row.updated_at, unreadCount: row.unread_count, muted: Boolean(mutedUntil && new Date(mutedUntil).getTime() > Date.now()), mutedUntil, archivedAt: preference?.archived_at ?? undefined, lastReadAt: preference?.last_read_at ?? undefined, lastReadMessageId: preference?.last_read_message_id ?? undefined, messages: [] } satisfies DirectConversation;
  });
  return { ok: true, data: conversations };
}

export async function createDirectConversation(otherUserId: string): Promise<DirectMessageServiceResult<string>> {
  if (!otherUserId.trim()) return failure("VALIDATION_ERROR", "Participant is required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("create_direct_conversation", { other_user_id: otherUserId });
  if (!result.error && result.data) return { ok: true, data: result.data };
  const message = result.error?.message ?? "";
  if (message.includes("DM_PRIVACY_DENIED") || message.includes("direct messages blocked")) return failure("PERMISSION_DENIED", "Direct conversation is blocked by privacy settings.");
  if (message.includes("AUTH_REQUIRED") || message.includes("authentication required")) return failure("AUTH_REQUIRED", "Sign in again to start a direct conversation.");
  return failure("REQUEST_FAILED", "Picom could not create or open this direct conversation.");
}

export async function sendDirectMessage(input: SendDirectMessageInput): Promise<DirectMessageServiceResult<DirectMessage>> {
  const requestedBody = input.body.trim();
  const attachments = input.attachments ?? [];
  if (!input.conversationId.trim() || (!requestedBody && attachments.length === 0) || requestedBody.length > 4000) return failure("VALIDATION_ERROR", "A valid conversation and message or attachment are required.");
  if (attachments.length > 4 || attachments.some((attachment) => !attachment.storagePath)) return failure("VALIDATION_ERROR", "Direct-message attachments must be uploaded before sending.");
  const body = requestedBody || (attachments.every((attachment) => attachment.mimeType?.startsWith("audio/")) ? "Voice message" : "Shared attachment");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const user = await currentUserId(); if (!user.ok) return user;
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();
  const context: MessageSendContext = {
    operation: "direct_message",
    correlationId: clientMessageId,
    actorId: user.data,
    conversationId: input.conversationId,
    clientMessageId,
  };
  const execution = await executeMessageSendWithRetry({
    client: configured.data,
    context,
    operation: async () => await configured.data.rpc("send_direct_message_v3", {
      target_conversation_id: input.conversationId,
      message_body: body,
      target_client_message_id: clientMessageId,
      target_reply_to_message_id: input.replyToMessageId ?? null,
      target_attachments: attachments.map((attachment) => ({ id: attachment.id, storage_path: attachment.storagePath, file_name: attachment.name, mime_type: attachment.mimeType, size_bytes: attachment.fileSize, width: attachment.width, height: attachment.height })),
    }),
    onAttempt: (event) => {
      const metadata = toMessageSendLogMetadata(context, event);
      if (event.outcome === "failure") loggingService.logWarn("Direct message send attempt failed", metadata, "message-send");
      else loggingService.logInfo("Direct message send attempt completed", metadata, "message-send");
    },
  });
  const result = execution.result;
  if (result.error) {
    const classified = execution.error ?? classifyMessageSendError(result.error, context);
    if (classified.category === "conflict") {
      const canonical = await configured.data
        .from("direct_messages")
        .select("id,conversation_id,author_id,body,reply_to_message_id,client_message_id,created_at,updated_at,edited_at,deleted_at")
        .eq("conversation_id", input.conversationId)
        .eq("author_id", user.data)
        .eq("client_message_id", clientMessageId)
        .maybeSingle();
      if (!canonical.error && isMessageRow(canonical.data)) {
        loggingService.logInfo("Direct message send reconciled after conflict", {
          ...toMessageSendLogMetadata(context, {
            attemptNumber: execution.attemptCount,
            outcome: "success",
            durationMs: 0,
            sessionRefreshAttempted: execution.sessionRefreshAttempted,
          }),
          server_message_id: canonical.data.id,
        }, "message-send");
        return { ok: true, data: { ...mapMessage(canonical.data), attachments: [] } };
      }
    }
    return { ok: false, error: classified };
  }
  if (!isMessageRow(result.data)) {
    const emptyResponse = classifyMessageSendError(
      { code: "DM_SEND_EMPTY_RESPONSE", message: "The send RPC returned no canonical direct message." },
      context,
    );
    return { ok: false, error: { ...emptyResponse, category: "server", retryable: true, userMessage: "The direct message could not be confirmed. Retry once.", message: "The direct message could not be confirmed. Retry once." } };
  }
  return { ok: true, data: { ...mapMessage(result.data), attachments } };
}

export async function editDirectMessage(messageId: string, bodyInput: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const body = bodyInput.trim(); if (!messageId.trim() || !body || body.length > 4000) return failure("VALIDATION_ERROR", "A valid message and body are required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("edit_direct_message", { target_message_id: messageId, message_body: body });
  return result.error || !result.data || typeof result.data !== "object" ? failure("REQUEST_FAILED", "Could not edit the direct message.") : { ok: true, data: mapMessage(result.data as unknown as MessageRow) };
}

export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  if (!messageId.trim()) return failure("VALIDATION_ERROR", "Message ID is required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("delete_direct_message", { target_message_id: messageId });
  return result.error || !result.data || typeof result.data !== "object" ? failure("REQUEST_FAILED", "Could not delete the direct message.") : { ok: true, data: mapMessage(result.data as unknown as MessageRow) };
}

export async function markDirectConversationRead(conversationId: string, throughMessageId?: string): Promise<boolean> {
  const configured = configuredClient(); if (!configured.ok) return false;
  const result = throughMessageId ? await configured.data.rpc("mark_direct_conversation_read_to", { target_conversation_id: conversationId, target_message_id: throughMessageId }) : await configured.data.rpc("mark_direct_conversation_read", { target_conversation_id: conversationId });
  return !result.error && result.data === true;
}

export async function setDirectConversationMuted(conversationId: string, mutedUntil: string | null): Promise<DirectMessageServiceResult<boolean>> {
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("set_direct_conversation_muted", { target_conversation_id: conversationId, target_muted_until: mutedUntil });
  return result.error || result.data !== true ? failure("REQUEST_FAILED", "Conversation mute state could not be updated.") : { ok: true, data: true };
}

export async function setDirectConversationArchived(conversationId: string, archived: boolean): Promise<DirectMessageServiceResult<boolean>> {
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("set_direct_conversation_archived", { target_conversation_id: conversationId, target_archived: archived });
  return result.error || result.data !== true ? failure("REQUEST_FAILED", "Conversation archive state could not be updated.") : { ok: true, data: true };
}

export async function getDirectSharedMedia(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectSharedMediaPage>> {
  const trimmedId = conversationId.trim();
  if (!trimmedId) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  if (!isConversationUuid(trimmedId)) return { ok: true, data: { items: [], hasMore: false } };
  const configured = configuredClient(); if (!configured.ok) return configured;
  const limit = normalizeLimit(options.limit, 24);
  const result = await configured.data.rpc("list_direct_shared_media", { target_conversation_id: trimmedId, before_created_at: options.before?.createdAt ?? null, before_attachment_id: options.before?.id ?? null, result_limit: limit + 1 });
  if (result.error) return failure("REQUEST_FAILED", "Shared media could not be loaded.");
  const rows = result.data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const ids = pageRows.map((row) => row.id);
  const meta = ids.length
    ? await configured.data.from("direct_message_attachments").select("id,url,storage_path").in("id", ids)
    : { data: [] as Array<{ id: string; url: string; storage_path: string | null }>, error: null };
  const metaById = new Map((meta.data ?? []).map((row) => [row.id, row]));
  const pathById = new Map<string, string>();
  for (const row of pageRows) {
    const metaRow = metaById.get(row.id);
    const rpcStoragePath = "storage_path" in row ? (row as { storage_path?: string | null }).storage_path : undefined;
    const path = resolveDirectAttachmentStoragePath(metaRow?.url ?? row.url, rpcStoragePath ?? metaRow?.storage_path);
    if (path) pathById.set(row.id, path);
  }
  const signedByPath = await signDirectAttachmentPaths([...pathById.values()]);
  const items = pageRows.map((row) => {
    const metaRow = metaById.get(row.id);
    const display = displayUrlForDirectAttachment(metaRow?.url ?? row.url, pathById.get(row.id) ?? null, signedByPath);
    return {
      id: row.id,
      messageId: row.message_id,
      type: directAttachmentTypeFromMime(row.mime_type),
      url: display.url,
      storagePath: display.storagePath,
      name: row.file_name ?? "attachment",
      mimeType: row.mime_type ?? undefined,
      fileSize: row.file_size ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      createdAt: row.created_at,
    };
  });
  const oldest = items[items.length - 1];
  return { ok: true, data: { items, hasMore, nextCursor: hasMore && oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined } };
}

export async function getPeerDirectReadState(conversationId: string, peerUserId: string): Promise<DirectMessageServiceResult<Readonly<{ lastReadAt?: string; lastReadMessageId?: string }>>> {
  if (!conversationId.trim() || !peerUserId.trim()) return failure("VALIDATION_ERROR", "Conversation and peer are required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const user = await currentUserId(); if (!user.ok) return user;
  if (user.data === peerUserId) return failure("VALIDATION_ERROR", "Peer read state requires the other participant.");
  const { data, error } = await configured.data
    .from("direct_conversation_participants")
    .select("last_read_at,last_read_message_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", peerUserId)
    .maybeSingle();
  if (error) return failure("REQUEST_FAILED", "Peer read state could not be loaded.");
  return {
    ok: true,
    data: {
      lastReadAt: data?.last_read_at ?? undefined,
      lastReadMessageId: data?.last_read_message_id ?? undefined,
    },
  };
}

export const directMessageService = { loadDirectConversations, getDirectMessages, getDirectMessagesPage, createDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, markDirectConversationRead, setDirectConversationMuted, setDirectConversationArchived, getDirectSharedMedia, getPeerDirectReadState };
