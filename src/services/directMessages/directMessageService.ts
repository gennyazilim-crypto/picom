import { currentUserId } from "../../data/mockCommunities";
import type { DirectMessage, DirectMessageAttachment } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import { directMessageService as supabaseDirectMessageService, type DirectMessageServiceResult, type SendDirectMessageInput } from "../supabase/directMessageService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { createOrOpenDirectConversation, directMessageMockStore, getDirectConversations, markDirectConversationRead } from "./directConversationService";
import { directRealtimeService, type DirectReactionRow } from "./directRealtimeService";

export type DirectMessageSendInput = SendDirectMessageInput & Readonly<{ attachments?: readonly DirectMessageAttachment[]; replyToMessageId?: string }>;
function failure<T>(message: string): DirectMessageServiceResult<T> { return { ok: false, error: { code: "REQUEST_FAILED", message } }; }

export async function getDirectMessages(conversationId: string): Promise<DirectMessageServiceResult<DirectMessage[]>> {
  if (!conversationId.trim()) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Conversation ID is required." } };
  if (dataSourceService.getStatus().isMock) return { ok: true, data: directMessageMockStore.find(conversationId)?.messages ?? [] };
  const base = await supabaseDirectMessageService.getDirectMessages(conversationId);
  if (!base.ok || !base.data.length) return base;
  const client = getSupabaseClient(); if (!client) return base;
  const messageIds = base.data.map((message) => message.id);
  const [attachmentsResult, reactionsResult] = await Promise.all([client.from("direct_message_attachments").select("id,message_id,url,file_name,mime_type,width,height").in("message_id", messageIds), client.from("direct_message_reactions").select("id,message_id,user_id,emoji,created_at").in("message_id", messageIds)]);
  if (attachmentsResult.error || reactionsResult.error) return failure("Direct message metadata could not be loaded.");
  const { data: authData } = await client.auth.getUser();
  return { ok: true, data: base.data.map((message) => {
    const attachments = (attachmentsResult.data ?? []).filter((item) => item.message_id === message.id).map((item) => ({ id: item.id, type: "image" as const, url: item.url, name: item.file_name ?? "attachment", mimeType: item.mime_type ?? undefined, width: item.width ?? undefined, height: item.height ?? undefined }));
    const grouped = new Map<string, { count: number; reactedByCurrentUser: boolean }>();
    for (const reaction of (reactionsResult.data ?? []).filter((item) => item.message_id === message.id)) { const current = grouped.get(reaction.emoji) ?? { count: 0, reactedByCurrentUser: false }; grouped.set(reaction.emoji, { count: current.count + 1, reactedByCurrentUser: current.reactedByCurrentUser || reaction.user_id === authData.user?.id }); }
    return { ...message, attachments, reactions: [...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value })) };
  }) };
}

export function sendDirectMessage(conversationId: string, body: string, attachments?: readonly DirectMessageAttachment[], replyToMessageId?: string, clientMessageId?: string): Promise<DirectMessageServiceResult<DirectMessage>>;
export function sendDirectMessage(input: DirectMessageSendInput): Promise<DirectMessageServiceResult<DirectMessage>>;
export async function sendDirectMessage(first: string | DirectMessageSendInput, bodyInput?: string, attachmentInput: readonly DirectMessageAttachment[] = [], replyInput?: string, clientIdInput?: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const input: DirectMessageSendInput = typeof first === "string" ? { conversationId: first, body: bodyInput ?? "", attachments: attachmentInput, replyToMessageId: replyInput, clientMessageId: clientIdInput } : first;
  const body = input.body.trim();
  if (!input.conversationId.trim() || !body || body.length > 4000) return { ok: false, error: { code: "VALIDATION_ERROR", message: "A valid conversation and message are required." } };
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();
  if (dataSourceService.getStatus().isMock) {
    const createdAt = new Date().toISOString(); const message: DirectMessage = { id: `dm-local-${clientMessageId}`, clientMessageId, conversationId: input.conversationId, authorId: currentUserId, body, createdAt, attachments: input.attachments };
    const updated = directMessageMockStore.replace(input.conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, message], lastMessagePreview: body, updatedAt: createdAt, unreadCount: 0 }));
    if (!updated) return failure("Direct conversation was not found.");
    directRealtimeService.publishMock({ type: "direct_message:insert", message }); return { ok: true, data: message };
  }
  const sent = await supabaseDirectMessageService.sendDirectMessage({ conversationId: input.conversationId, body, clientMessageId });
  if (!sent.ok) return sent;
  const client = getSupabaseClient(); if (!client) return sent;
  if (input.replyToMessageId) { const replyUpdate = await client.from("direct_messages").update({ reply_to_message_id: input.replyToMessageId }).eq("id", sent.data.id); if (replyUpdate.error) return failure("The direct message reply could not be linked."); }
  if (input.attachments?.length) { const attachmentInsert = await client.from("direct_message_attachments").insert(input.attachments.map((attachment) => ({ message_id: sent.data.id, url: attachment.url, file_name: attachment.name, mime_type: attachment.mimeType ?? null, width: attachment.width ?? null, height: attachment.height ?? null }))); if (attachmentInsert.error) return failure("The direct message attachment metadata could not be saved."); }
  return { ok: true, data: { ...sent.data, attachments: input.attachments } };
}

export async function editDirectMessage(messageId: string, body: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.editDirectMessage(messageId, body);
  let edited: DirectMessage | undefined;
  for (const conversation of directMessageMockStore.list()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId || message.authorId !== currentUserId) return message; edited = { ...message, body: body.trim(), editedAt: new Date().toISOString() }; return edited; }), lastMessagePreview: current.messages[current.messages.length - 1]?.id === messageId ? body.trim() : current.lastMessagePreview }));
  if (!edited) return failure("The direct message could not be edited."); directRealtimeService.publishMock({ type: "direct_message:update", message: edited }); return { ok: true, data: edited };
}

export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.deleteDirectMessage(messageId);
  let deleted: DirectMessage | undefined;
  for (const conversation of directMessageMockStore.list()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId || message.authorId !== currentUserId) return message; deleted = { ...message, body: "", deletedAt: new Date().toISOString() }; return deleted; }), lastMessagePreview: current.messages[current.messages.length - 1]?.id === messageId ? "Message deleted" : current.lastMessagePreview }));
  if (!deleted) return failure("The direct message could not be deleted."); directRealtimeService.publishMock({ type: "direct_message:update", message: deleted }); return { ok: true, data: deleted };
}

async function setDirectReaction(messageId: string, emojiInput: string, add: boolean): Promise<DirectMessageServiceResult<boolean>> {
  const emoji = emojiInput.trim(); if (!messageId.trim() || !emoji) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Message and emoji are required." } };
  if (dataSourceService.getStatus().isSupabase) { const client = getSupabaseClient(); if (!client) return failure("Supabase is not configured."); const { data } = await client.auth.getUser(); if (!data.user) return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to react to direct messages." } }; const result = add ? await client.from("direct_message_reactions").insert({ message_id: messageId, user_id: data.user.id, emoji }) : await client.from("direct_message_reactions").delete().eq("message_id", messageId).eq("user_id", data.user.id).eq("emoji", emoji); return result.error ? failure("The direct message reaction could not be updated.") : { ok: true, data: true }; }
  const reaction: DirectReactionRow = { id: `dm-reaction-${messageId}-${emoji}-${currentUserId}`, message_id: messageId, user_id: currentUserId, emoji, created_at: new Date().toISOString() };
  directRealtimeService.publishMock({ type: add ? "direct_reaction:add" : "direct_reaction:remove", reaction }); return { ok: true, data: true };
}

export const addDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, true);
export const removeDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, false);
export const directMessageService = { getDirectConversations, loadDirectConversations: getDirectConversations, getDirectMessages, createOrOpenDirectConversation, createDirectConversation: createOrOpenDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, addDirectReaction, removeDirectReaction, markDirectConversationRead };
