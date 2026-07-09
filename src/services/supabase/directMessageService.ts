import { getSupabaseClient, getSupabaseClientStatus } from "./supabaseClient";
import type { Database } from "./database.types";

type ConversationRow = Database["public"]["Tables"]["direct_conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];

type DirectMessageErrorCode = "NOT_CONFIGURED" | "AUTH_REQUIRED" | "VALIDATION_ERROR" | "REQUEST_FAILED";
export type DirectMessageServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: Readonly<{ code: DirectMessageErrorCode; message: string }> }>;

export type SendDirectMessageInput = Readonly<{
  conversationId: string;
  body: string;
  clientMessageId?: string;
}>;

function failure(code: DirectMessageErrorCode, message: string): DirectMessageServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function configuredClient() {
  const status = getSupabaseClientStatus();
  const client = getSupabaseClient();
  if (!status.configured || !client) return failure("NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  return { ok: true as const, data: client };
}

async function currentUserId(): Promise<DirectMessageServiceResult<string>> {
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const { data, error } = await configured.data.auth.getUser();
  if (error || !data.user) return failure("AUTH_REQUIRED", "Sign in to use direct messages.");
  return { ok: true, data: data.user.id };
}

export async function getDirectConversations(): Promise<DirectMessageServiceResult<ConversationRow[]>> {
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const { data, error } = await configured.data.from("direct_conversations").select("id,type,created_by,created_at,updated_at").order("updated_at", { ascending: false });
  if (error) return failure("REQUEST_FAILED", "Could not load direct conversations.");
  return { ok: true, data: data ?? [] };
}

export async function getDirectMessages(conversationId: string): Promise<DirectMessageServiceResult<MessageRow[]>> {
  if (!conversationId.trim()) return failure("VALIDATION_ERROR", "Conversation ID is required.");
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const { data, error } = await configured.data.from("direct_messages").select("id,conversation_id,author_id,body,client_message_id,created_at,updated_at,edited_at,deleted_at").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) return failure("REQUEST_FAILED", "Could not load direct messages.");
  return { ok: true, data: data ?? [] };
}

export async function sendDirectMessage(input: SendDirectMessageInput): Promise<DirectMessageServiceResult<MessageRow>> {
  const body = input.body.trim();
  if (!input.conversationId.trim() || !body || body.length > 4000) return failure("VALIDATION_ERROR", "A valid conversation and message are required.");
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const user = await currentUserId();
  if (!user.ok) return user;
  const { data, error } = await configured.data.from("direct_messages").insert({ conversation_id: input.conversationId, author_id: user.data, body, client_message_id: input.clientMessageId ?? null }).select().single();
  if (error || !data) return failure("REQUEST_FAILED", "Could not send the direct message.");
  return { ok: true, data };
}

export async function editDirectMessage(messageId: string, bodyInput: string): Promise<DirectMessageServiceResult<MessageRow>> {
  const body = bodyInput.trim();
  if (!messageId.trim() || !body || body.length > 4000) return failure("VALIDATION_ERROR", "A valid message and body are required.");
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const now = new Date().toISOString();
  const { data, error } = await configured.data.from("direct_messages").update({ body, edited_at: now, updated_at: now }).eq("id", messageId).is("deleted_at", null).select().single();
  if (error || !data) return failure("REQUEST_FAILED", "Could not edit the direct message.");
  return { ok: true, data };
}

export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<MessageRow>> {
  if (!messageId.trim()) return failure("VALIDATION_ERROR", "Message ID is required.");
  const configured = configuredClient();
  if (!configured.ok) return configured;
  const now = new Date().toISOString();
  const { data, error } = await configured.data.from("direct_messages").update({ body: "", deleted_at: now, updated_at: now }).eq("id", messageId).is("deleted_at", null).select().single();
  if (error || !data) return failure("REQUEST_FAILED", "Could not delete the direct message.");
  return { ok: true, data };
}

export const directMessageService = { getDirectConversations, getDirectMessages, sendDirectMessage, editDirectMessage, deleteDirectMessage };
