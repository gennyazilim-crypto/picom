import type { DirectConversation, DirectMessage } from "../../types/directMessages";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabaseClient";
import type { Database } from "./database.types";

type MessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
type DirectMessageErrorCode = "NOT_CONFIGURED" | "AUTH_REQUIRED" | "VALIDATION_ERROR" | "REQUEST_FAILED" | "PERMISSION_DENIED";
export type DirectMessageServiceResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: Readonly<{ code: DirectMessageErrorCode; message: string }> }>;
export type SendDirectMessageInput = Readonly<{ conversationId: string; body: string; clientMessageId?: string; replyToMessageId?: string }>;

function failure(code: DirectMessageErrorCode, message: string): DirectMessageServiceResult<never> { return { ok: false, error: { code, message } }; }
function configuredClient() { const status = getSupabaseClientStatus(); const client = getSupabaseClient(); if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured."); return { ok: true as const, data: client }; }
async function currentUserId(): Promise<DirectMessageServiceResult<string>> { const configured = configuredClient(); if (!configured.ok) return configured; const { data, error } = await configured.data.auth.getUser(); if (error || !data.user) return failure("AUTH_REQUIRED", "Sign in to use direct messages."); return { ok: true, data: data.user.id }; }
function mapMessage(row: MessageRow): DirectMessage { return { id: row.id, conversationId: row.conversation_id, authorId: row.author_id, body: row.body ?? "", clientMessageId: row.client_message_id ?? undefined, createdAt: row.created_at, editedAt: row.edited_at ?? undefined, deletedAt: row.deleted_at ?? undefined }; }

export async function getDirectMessages(conversationId: string): Promise<DirectMessageServiceResult<DirectMessage[]>> {
  if (!conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  const configured = configuredClient(); if (!configured.ok) return configured;
  const { data, error } = await configured.data.from("direct_messages").select("id,conversation_id,author_id,body,reply_to_message_id,client_message_id,created_at,updated_at,edited_at,deleted_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(100);
  if (error) return failure("REQUEST_FAILED", "Could not load direct messages.");
  return { ok: true, data: (data ?? []).reverse().map(mapMessage) };
}

export async function loadDirectConversations(): Promise<DirectMessageServiceResult<DirectConversation[]>> {
  const configured = configuredClient(); if (!configured.ok) return configured;
  const result = await configured.data.rpc("list_direct_conversations", { result_limit: 50 });
  if (result.error) return failure("REQUEST_FAILED", "Could not load direct conversations.");
  const conversations = await Promise.all((result.data ?? []).map(async (row) => {
    const messages = await getDirectMessages(row.id);
    const participantStatus = row.participant_status === "offline" || row.participant_status === "idle" || row.participant_status === "dnd" ? row.participant_status : row.participant_status === "busy" ? "dnd" : "online";
    return { id: row.id, participantUserId: row.participant_user_id, participantName: row.participant_name, participantUsername: row.participant_username, participantStatus, participantStatusText: row.participant_status_text, lastMessagePreview: row.last_message_preview, updatedAt: row.updated_at, unreadCount: row.unread_count, messages: messages.ok ? messages.data : [] } satisfies DirectConversation;
  }));
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
  const configured = configuredClient(); if (!configured.ok) return configured;
  const user = await currentUserId(); if (!user.ok) return user;
  const result = await configured.data.rpc("send_direct_message_v2", { target_conversation_id: input.conversationId, message_body: body, target_client_message_id: input.clientMessageId ?? crypto.randomUUID(), target_reply_to_message_id: input.replyToMessageId ?? null });
  if (result.error || !result.data || typeof result.data !== "object") return failure("PERMISSION_DENIED", "Direct message was blocked by membership or privacy controls.");
  return { ok: true, data: mapMessage(result.data as unknown as MessageRow) };
}

export async function editDirectMessage(messageId: string, bodyInput: string): Promise<DirectMessageServiceResult<DirectMessage>> { const body = bodyInput.trim(); if (!messageId.trim() || !body || body.length > 4000) return failure("VALIDATION_ERROR", "A valid message and body are required."); const configured = configuredClient(); if (!configured.ok) return configured; const now = new Date().toISOString(); const { data, error } = await configured.data.from("direct_messages").update({ body, edited_at: now, updated_at: now }).eq("id", messageId).is("deleted_at", null).select().single(); return error || !data ? failure("REQUEST_FAILED", "Could not edit the direct message.") : { ok: true, data: mapMessage(data) }; }
export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<DirectMessage>> { if (!messageId.trim()) return failure("VALIDATION_ERROR", "Message ID is required."); const configured = configuredClient(); if (!configured.ok) return configured; const now = new Date().toISOString(); const { data, error } = await configured.data.from("direct_messages").update({ body: "", deleted_at: now, updated_at: now }).eq("id", messageId).is("deleted_at", null).select().single(); return error || !data ? failure("REQUEST_FAILED", "Could not delete the direct message.") : { ok: true, data: mapMessage(data) }; }
export async function markDirectConversationRead(conversationId: string): Promise<boolean> { const configured = configuredClient(); if (!configured.ok) return false; const result = await configured.data.rpc("mark_direct_conversation_read", { target_conversation_id: conversationId }); return !result.error && result.data === true; }

export const directMessageService = { loadDirectConversations, getDirectMessages, createDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, markDirectConversationRead };
