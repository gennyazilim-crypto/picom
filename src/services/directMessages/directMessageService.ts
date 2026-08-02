import { directAttachmentTypeFromMime, type DirectMessage, type DirectMessageAttachment, type DirectMessagePage, type DirectSharedMediaPage } from "../../types/directMessages";
import { directMessageService as supabaseDirectMessageService, type DirectMessagePageOptions, type DirectMessageServiceResult, type SendDirectMessageInput } from "../supabase/directMessageService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { createOrOpenDirectConversation, deleteDirectConversation, getDirectConversations, markDirectConversationRead, setDirectConversationArchived, setDirectConversationMuted } from "./directConversationService";
import { displayUrlForDirectAttachment, isRenderableDirectAttachmentUrl, resolveDirectAttachmentStoragePath, signDirectAttachmentPaths } from "./directAttachmentUploadService";

export type DirectMessageSendInput = SendDirectMessageInput;
function failure<T>(message: string): DirectMessageServiceResult<T> { return { ok: false, error: { code: "REQUEST_FAILED", message } }; }
async function enrichSupabasePage(page: DirectMessagePage): Promise<DirectMessageServiceResult<DirectMessagePage>> {
  if (!page.items.length) return { ok: true, data: page };
  const client = getSupabaseClient(); if (!client) return { ok: true, data: page };
  const messageIds = page.items.map((message) => message.id);
  const replyIds = [...new Set(page.items.map((message) => message.replyToMessageId).filter((id): id is string => Boolean(id)))];
  const [attachmentsResult, reactionsResult, repliesResult] = await Promise.all([
    client.from("direct_message_attachments").select("id,message_id,url,storage_path,file_name,mime_type,file_size,size_bytes,width,height,created_at").in("message_id", messageIds),
    client.from("direct_message_reactions").select("id,message_id,user_id,emoji,created_at").in("message_id", messageIds),
    replyIds.length ? client.from("direct_messages").select("id,author_id,body,deleted_at").in("id", replyIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (attachmentsResult.error || reactionsResult.error || repliesResult.error) return failure("Direct message metadata could not be loaded.");
  const replyRows = repliesResult.data ?? [];
  const authorIds = [...new Set(replyRows.map((row) => row.author_id))];
  const profilesResult = authorIds.length ? await client.from("profiles").select("id,display_name").in("id", authorIds) : { data: [], error: null };
  if (profilesResult.error) return failure("Reply author metadata could not be loaded.");
  const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const { data: authData } = await client.auth.getUser();
  const storedPaths = [...new Set((attachmentsResult.data ?? [])
    .map((item) => resolveDirectAttachmentStoragePath(item.url, item.storage_path))
    .filter((value): value is string => Boolean(value)))];
  const signedByPath = await signDirectAttachmentPaths(storedPaths);
  const items = page.items.map((message) => {
    const attachments = (attachmentsResult.data ?? []).filter((item) => item.message_id === message.id).map((item) => {
      const display = displayUrlForDirectAttachment(item.url, item.storage_path, signedByPath);
      return {
        id: item.id,
        messageId: item.message_id,
        type: directAttachmentTypeFromMime(item.mime_type),
        url: display.url,
        storagePath: display.storagePath,
        name: item.file_name ?? "attachment",
        mimeType: item.mime_type ?? undefined,
        fileSize: item.size_bytes ?? item.file_size ?? undefined,
        width: item.width ?? undefined,
        height: item.height ?? undefined,
        createdAt: item.created_at,
      };
    });
    const grouped = new Map<string, { count: number; reactedByCurrentUser: boolean }>();
    for (const reaction of (reactionsResult.data ?? []).filter((item) => item.message_id === message.id)) { const current = grouped.get(reaction.emoji) ?? { count: 0, reactedByCurrentUser: false }; grouped.set(reaction.emoji, { count: current.count + 1, reactedByCurrentUser: current.reactedByCurrentUser || reaction.user_id === authData.user?.id }); }
    const reply = message.replyToMessageId ? replyRows.find((row) => row.id === message.replyToMessageId) : undefined;
    return { ...message, attachments, reactions: [...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value })), replyPreview: message.replyToMessageId ? { messageId: message.replyToMessageId, authorName: reply ? profileNames.get(reply.author_id) ?? "Picom member" : "Picom member", body: !reply ? "Message unavailable" : reply.deleted_at ? "Message deleted" : reply.body ?? "Message unavailable" } : undefined };
  });
  return { ok: true, data: { ...page, items } };
}

export async function getDirectMessagesPage(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectMessagePage>> {
  if (!conversationId.trim()) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Conversation ID is required." } };
  const page = await supabaseDirectMessageService.getDirectMessagesPage(conversationId, options);
  return page.ok ? enrichSupabasePage(page.data) : page;
}

export async function getDirectMessages(conversationId: string): Promise<DirectMessageServiceResult<DirectMessage[]>> {
  const page = await getDirectMessagesPage(conversationId, { limit: 100 });
  return page.ok ? { ok: true, data: page.data.items } : page;
}

export async function addDirectMessageAttachments(messageId: string, attachments: readonly DirectMessageAttachment[]): Promise<DirectMessageServiceResult<DirectMessageAttachment[]>> {
  if (!messageId.trim()) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Message ID is required." } };
  if (!attachments.length) return { ok: true, data: [] };
  const client = getSupabaseClient(); if (!client) return failure("Supabase is not configured.");
  const persistedUrls = attachments.map((attachment) => attachment.storagePath ?? attachment.url);
  const existing = await client.from("direct_message_attachments").select("url").eq("message_id", messageId).in("url", persistedUrls);
  if (existing.error) return failure("Existing direct message attachments could not be checked.");
  const existingUrls = new Set((existing.data ?? []).map((item) => item.url));
  const pending = attachments.filter((attachment) => !existingUrls.has(attachment.storagePath ?? attachment.url));
  if (!pending.length) return { ok: true, data: [...attachments] };
  const inserted = await client.from("direct_message_attachments").insert(pending.map((attachment) => ({ id: attachment.id, message_id: messageId, url: attachment.storagePath ?? attachment.url, storage_path: attachment.storagePath ?? null, file_name: attachment.name, mime_type: attachment.mimeType ?? null, file_size: attachment.fileSize ?? null, size_bytes: attachment.fileSize ?? null, width: attachment.width ?? null, height: attachment.height ?? null }))).select("id,message_id,url,storage_path,file_name,mime_type,file_size,size_bytes,width,height,created_at");
  if (inserted.error) return failure("The direct message attachment metadata could not be saved.");
  return { ok: true, data: (inserted.data ?? []).map((item) => {
    const source = pending.find((attachment) => attachment.id === item.id);
    const storagePath = item.storage_path ?? source?.storagePath;
    const displayUrl = source && isRenderableDirectAttachmentUrl(source.url) ? source.url : "";
    return {
      id: item.id,
      messageId: item.message_id,
      type: directAttachmentTypeFromMime(item.mime_type),
      url: displayUrl,
      storagePath: storagePath ?? undefined,
      name: item.file_name ?? "attachment",
      mimeType: item.mime_type ?? undefined,
      fileSize: item.size_bytes ?? item.file_size ?? undefined,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      createdAt: item.created_at,
    };
  }) };
}

export async function sendDirectMessage(conversationId: string, body: string, attachments?: readonly DirectMessageAttachment[], replyToMessageId?: string, clientMessageId?: string): Promise<DirectMessageServiceResult<DirectMessage>>;
export async function sendDirectMessage(input: DirectMessageSendInput): Promise<DirectMessageServiceResult<DirectMessage>>;
export async function sendDirectMessage(first: string | DirectMessageSendInput, bodyInput?: string, attachmentInput: readonly DirectMessageAttachment[] = [], replyInput?: string, clientIdInput?: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const input: DirectMessageSendInput = typeof first === "string" ? { conversationId: first, body: bodyInput ?? "", attachments: attachmentInput, replyToMessageId: replyInput, clientMessageId: clientIdInput } : first;
  const body = input.body.trim();
  const attachments = input.attachments ?? [];
  if (!input.conversationId.trim() || (!body && attachments.length === 0) || body.length > 4000) return { ok: false, error: { code: "VALIDATION_ERROR", message: "A valid conversation and message or attachment are required." } };
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();
  return supabaseDirectMessageService.sendDirectMessage({ conversationId: input.conversationId, body, clientMessageId, replyToMessageId: input.replyToMessageId, attachments });
}

export async function editDirectMessage(messageId: string, body: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const normalized = body.trim();
  if (!normalized || normalized.length > 4000) return { ok: false, error: { code: "VALIDATION_ERROR", message: "A valid message body is required." } };
  return supabaseDirectMessageService.editDirectMessage(messageId, normalized);
}

export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  return supabaseDirectMessageService.deleteDirectMessage(messageId);
}

async function setDirectReaction(messageId: string, emojiInput: string, add: boolean): Promise<DirectMessageServiceResult<boolean>> {
  const emoji = emojiInput.trim();
  if (!messageId.trim() || !emoji) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Message and emoji are required." } };
  const client = getSupabaseClient();
  if (!client) return failure("Supabase is not configured.");
  const { data } = await client.auth.getUser();
  if (!data.user) return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to react to direct messages." } };
  const result = add
    ? await client.from("direct_message_reactions").upsert({ message_id: messageId, user_id: data.user.id, emoji }, { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true })
    : await client.from("direct_message_reactions").delete().eq("message_id", messageId).eq("user_id", data.user.id).eq("emoji", emoji);
  return result.error ? failure("The direct message reaction could not be updated.") : { ok: true, data: true };
}

export async function getDirectSharedMedia(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectSharedMediaPage>> {
  return supabaseDirectMessageService.getDirectSharedMedia(conversationId, options);
}

export async function getPeerDirectReadState(conversationId: string, peerUserId: string): Promise<DirectMessageServiceResult<Readonly<{ lastReadAt?: string; lastReadMessageId?: string }>>> {
  return supabaseDirectMessageService.getPeerDirectReadState(conversationId, peerUserId);
}

export const addDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, true);
export const removeDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, false);
export const directMessageService = { getDirectConversations, loadDirectConversations: getDirectConversations, getDirectMessages, getDirectMessagesPage, createOrOpenDirectConversation, createDirectConversation: createOrOpenDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, addDirectMessageAttachments, addDirectReaction, removeDirectReaction, markDirectConversationRead, setDirectConversationMuted, setDirectConversationArchived, deleteDirectConversation, getDirectSharedMedia, getPeerDirectReadState };
