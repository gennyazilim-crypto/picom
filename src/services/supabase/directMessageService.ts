import type { DirectConversation, DirectMessage, DirectMessageAttachment, DirectMessageCursor, DirectMessagePage, DirectSharedMediaPage } from "../../types/directMessages";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabaseClient";
import type { Database } from "./database.types";

type MessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
type DirectMessageErrorCode = "NOT_CONFIGURED" | "AUTH_REQUIRED" | "VALIDATION_ERROR" | "REQUEST_FAILED" | "PERMISSION_DENIED" | "IDEMPOTENCY_CONFLICT";
export type DirectMessageServiceResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: Readonly<{ code: DirectMessageErrorCode; message: string }> }>;
export type SendDirectMessageInput = Readonly<{ conversationId: string; body: string; clientMessageId?: string; replyToMessageId?: string; attachments?: readonly DirectMessageAttachment[] }>;
export type DirectMessagePageOptions = Readonly<{ limit?: number; before?: DirectMessageCursor }>;

function failure(code: DirectMessageErrorCode, message: string): DirectMessageServiceResult<never> { return { ok: false, error: { code, message } }; }
function configuredClient() { const status = getSupabaseClientStatus(); const client = getSupabaseClient(); if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured."); return { ok: true as const, data: client }; }
async function currentUserId(): Promise<DirectMessageServiceResult<string>> { const configured = configuredClient(); if (!configured.ok) return configured; const { data, error } = await configured.data.auth.getUser(); if (error || !data.user) return failure("AUTH_REQUIRED", "Sign in to use direct messages."); return { ok: true, data: data.user.id }; }
function mapMessage(row: MessageRow): DirectMessage { return { id: row.id, conversationId: row.conversation_id, authorId: row.author_id, body: row.body ?? "", clientMessageId: row.client_message_id ?? undefined, replyToMessageId: row.reply_to_message_id ?? undefined, createdAt: row.created_at, editedAt: row.edited_at ?? undefined, deletedAt: row.deleted_at ?? undefined }; }
function normalizeLimit(value: number | undefined, fallback = 50): number { return Math.max(1, Math.min(Math.floor(value ?? fallback), 100)); }

export async function getDirectMessagesPage(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectMessagePage>> {
  if (!conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const limit = normalizeLimit(options.limit);
  let query = configured.data.from("direct_messages").select("id,conversation_id,author_id,body,reply_to_message_id,client_message_id,created_at,updated_at,edited_at,deleted_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (options.before) query = query.or(`created_at.lt.${options.before.createdAt},and(created_at.eq.${options.before.createdAt},id.lt.${options.before.id})`);
  const { data, error } = await query;
  if (error) return failure("REQUEST_FAILED", "Could not load direct messages.");
  const descending = (data ?? []).map((row) => mapMessage(row as MessageRow));
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
  if (preferences.error) return failure("REQUEST_FAILED", "Could not load direct conversation preferences.");
  const preferenceByConversation = new Map((preferences.data ?? []).map((row) => [row.conversation_id, row]));
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
  return result.error || !result.data ? failure("PERMISSION_DENIED", "Direct conversation could not be created due to privacy settings.") : { ok: true, data: result.data };
}

export async function sendDirectMessage(input: SendDirectMessageInput): Promise<DirectMessageServiceResult<DirectMessage>> {
  const body = input.body.trim();
  if (!input.conversationId.trim() || !body || body.length > 4000) return failure("VALIDATION_ERROR", "A valid conversation and message are required.");
  const attachments = input.attachments ?? [];
  if (attachments.length > 4 || attachments.some((attachment) => !attachment.storagePath)) return failure("VALIDATION_ERROR", "Direct-message attachments must be uploaded before sending.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const user = await currentUserId(); if (!user.ok) return user;
  const result = await configured.data.rpc("send_direct_message_v3", {
    target_conversation_id: input.conversationId,
    message_body: body,
    target_client_message_id: input.clientMessageId ?? crypto.randomUUID(),
    target_reply_to_message_id: input.replyToMessageId ?? null,
    target_attachments: attachments.map((attachment) => ({ id: attachment.id, storage_path: attachment.storagePath, file_name: attachment.name, mime_type: attachment.mimeType, size_bytes: attachment.fileSize, width: attachment.width, height: attachment.height })),
  });
  if (result.error || !result.data || typeof result.data !== "object") {
    if (result.error?.message.includes("DM_IDEMPOTENCY_CONFLICT")) return failure("IDEMPOTENCY_CONFLICT", "This retry key was already used for a different direct message.");
    return failure("PERMISSION_DENIED", "Direct message was blocked by membership, attachment, or privacy controls.");
  }
  return { ok: true, data: { ...mapMessage(result.data as unknown as MessageRow), attachments } };
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
  if (!conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const limit = normalizeLimit(options.limit, 24);
  const result = await configured.data.rpc("list_direct_shared_media", { target_conversation_id: conversationId, before_created_at: options.before?.createdAt ?? null, before_attachment_id: options.before?.id ?? null, result_limit: limit + 1 });
  if (result.error) return failure("REQUEST_FAILED", "Shared media could not be loaded.");
  const rows = result.data ?? []; const hasMore = rows.length > limit;
  const items = await Promise.all(rows.slice(0, limit).map(async (row) => { const storagePath = !/^(https?:|blob:|data:)/i.test(row.url) ? row.url : undefined; const signed = storagePath ? await configured.data.storage.from("direct-message-attachments").createSignedUrl(storagePath, 60 * 60) : null; return { id: row.id, messageId: row.message_id, type: row.mime_type?.startsWith("image/") === false ? "file" as const : "image" as const, url: signed?.data?.signedUrl ?? row.url, storagePath, name: row.file_name ?? "attachment", mimeType: row.mime_type ?? undefined, fileSize: row.file_size ?? undefined, width: row.width ?? undefined, height: row.height ?? undefined, createdAt: row.created_at }; }));
  const oldest = items[items.length - 1];
  return { ok: true, data: { items, hasMore, nextCursor: hasMore && oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined } };
}

export const directMessageService = { loadDirectConversations, getDirectMessages, getDirectMessagesPage, createDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, markDirectConversationRead, setDirectConversationMuted, setDirectConversationArchived, getDirectSharedMedia };
