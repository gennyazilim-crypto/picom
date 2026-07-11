import { currentUserId } from "../../data/mockCommunities";
import type { DirectMessage, DirectMessageAttachment, DirectMessageCursor, DirectMessagePage, DirectSharedMediaItem, DirectSharedMediaPage } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import { directMessageService as supabaseDirectMessageService, type DirectMessagePageOptions, type DirectMessageServiceResult, type SendDirectMessageInput } from "../supabase/directMessageService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { createOrOpenDirectConversation, directMessageMockStore, getDirectConversations, markDirectConversationRead, setDirectConversationArchived, setDirectConversationMuted } from "./directConversationService";
import { directRealtimeService, type DirectReactionRow } from "./directRealtimeService";

export type DirectMessageSendInput = SendDirectMessageInput & Readonly<{ attachments?: readonly DirectMessageAttachment[]; replyToMessageId?: string }>;
function failure<T>(message: string): DirectMessageServiceResult<T> { return { ok: false, error: { code: "REQUEST_FAILED", message } }; }
function normalizeLimit(value: number | undefined, fallback = 50): number { return Math.max(1, Math.min(Math.floor(value ?? fallback), 100)); }
function cursorFor(message: DirectMessage | DirectSharedMediaItem | undefined): DirectMessageCursor | undefined { return message ? { createdAt: message.createdAt, id: message.id } : undefined; }

function mockMessagePage(conversationId: string, options: DirectMessagePageOptions): DirectMessageServiceResult<DirectMessagePage> {
  const conversation = directMessageMockStore.find(conversationId); if (!conversation) return failure("Direct conversation was not found.");
  const limit = normalizeLimit(options.limit);
  const ordered = [...conversation.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const eligible = options.before ? ordered.filter((message) => message.createdAt < options.before!.createdAt || (message.createdAt === options.before!.createdAt && message.id < options.before!.id)) : ordered;
  const hasMore = eligible.length > limit; const items = eligible.slice(Math.max(0, eligible.length - limit));
  return { ok: true, data: { items, hasMore, nextCursor: hasMore ? cursorFor(items[0]) : undefined } };
}

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
  const storedPaths = [...new Set((attachmentsResult.data ?? []).map((item) => item.storage_path ?? (!/^(https?:|blob:|data:)/i.test(item.url) ? item.url : null)).filter((value): value is string => Boolean(value)))];
  const signedByPath = new Map<string, string>();
  await Promise.all(storedPaths.map(async (path) => { const signed = await client.storage.from("direct-message-attachments").createSignedUrl(path, 60 * 60); if (signed.data?.signedUrl) signedByPath.set(path, signed.data.signedUrl); }));
  const items = page.items.map((message) => {
    const attachments = (attachmentsResult.data ?? []).filter((item) => item.message_id === message.id).map((item) => { const storagePath = item.storage_path ?? (!/^(https?:|blob:|data:)/i.test(item.url) ? item.url : undefined); return { id: item.id, messageId: item.message_id, type: item.mime_type?.startsWith("image/") === false ? "file" as const : "image" as const, url: storagePath ? signedByPath.get(storagePath) ?? item.url : item.url, storagePath, name: item.file_name ?? "attachment", mimeType: item.mime_type ?? undefined, fileSize: item.size_bytes ?? item.file_size ?? undefined, width: item.width ?? undefined, height: item.height ?? undefined, createdAt: item.created_at }; });
    const grouped = new Map<string, { count: number; reactedByCurrentUser: boolean }>();
    for (const reaction of (reactionsResult.data ?? []).filter((item) => item.message_id === message.id)) { const current = grouped.get(reaction.emoji) ?? { count: 0, reactedByCurrentUser: false }; grouped.set(reaction.emoji, { count: current.count + 1, reactedByCurrentUser: current.reactedByCurrentUser || reaction.user_id === authData.user?.id }); }
    const reply = message.replyToMessageId ? replyRows.find((row) => row.id === message.replyToMessageId) : undefined;
    return { ...message, attachments, reactions: [...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value })), replyPreview: message.replyToMessageId ? { messageId: message.replyToMessageId, authorName: reply ? profileNames.get(reply.author_id) ?? "Picom member" : "Picom member", body: !reply ? "Message unavailable" : reply.deleted_at ? "Message deleted" : reply.body ?? "Message unavailable" } : undefined };
  });
  return { ok: true, data: { ...page, items } };
}

export async function getDirectMessagesPage(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectMessagePage>> {
  if (!conversationId.trim()) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Conversation ID is required." } };
  if (dataSourceService.getStatus().isMock) return mockMessagePage(conversationId, options);
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
  if (dataSourceService.getStatus().isMock) {
    let saved = false;
    for (const conversation of directMessageMockStore.listAll()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId) return message; saved = true; const existing = new Set((message.attachments ?? []).map((attachment) => attachment.url)); return { ...message, attachments: [...(message.attachments ?? []), ...attachments.filter((attachment) => !existing.has(attachment.url))] }; }) }));
    return saved ? { ok: true, data: [...attachments] } : failure("Direct message was not found.");
  }
  const client = getSupabaseClient(); if (!client) return failure("Supabase is not configured.");
  const persistedUrls = attachments.map((attachment) => attachment.storagePath ?? attachment.url);
  const existing = await client.from("direct_message_attachments").select("url").eq("message_id", messageId).in("url", persistedUrls);
  if (existing.error) return failure("Existing direct message attachments could not be checked.");
  const existingUrls = new Set((existing.data ?? []).map((item) => item.url));
  const pending = attachments.filter((attachment) => !existingUrls.has(attachment.storagePath ?? attachment.url));
  if (!pending.length) return { ok: true, data: [...attachments] };
  const inserted = await client.from("direct_message_attachments").insert(pending.map((attachment) => ({ id: attachment.id, message_id: messageId, url: attachment.storagePath ?? attachment.url, storage_path: attachment.storagePath ?? null, file_name: attachment.name, mime_type: attachment.mimeType ?? null, file_size: attachment.fileSize ?? null, size_bytes: attachment.fileSize ?? null, width: attachment.width ?? null, height: attachment.height ?? null }))).select("id,message_id,url,storage_path,file_name,mime_type,file_size,size_bytes,width,height,created_at");
  if (inserted.error) return failure("The direct message attachment metadata could not be saved.");
  return { ok: true, data: (inserted.data ?? []).map((item) => { const source = pending.find((attachment) => attachment.id === item.id); return { id: item.id, messageId: item.message_id, type: item.mime_type?.startsWith("image/") === false ? "file" as const : "image" as const, url: source?.url ?? item.url, storagePath: item.storage_path ?? source?.storagePath, name: item.file_name ?? "attachment", mimeType: item.mime_type ?? undefined, fileSize: item.size_bytes ?? item.file_size ?? undefined, width: item.width ?? undefined, height: item.height ?? undefined, createdAt: item.created_at }; }) };
}

export async function sendDirectMessage(conversationId: string, body: string, attachments?: readonly DirectMessageAttachment[], replyToMessageId?: string, clientMessageId?: string): Promise<DirectMessageServiceResult<DirectMessage>>;
export async function sendDirectMessage(input: DirectMessageSendInput): Promise<DirectMessageServiceResult<DirectMessage>>;
export async function sendDirectMessage(first: string | DirectMessageSendInput, bodyInput?: string, attachmentInput: readonly DirectMessageAttachment[] = [], replyInput?: string, clientIdInput?: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const input: DirectMessageSendInput = typeof first === "string" ? { conversationId: first, body: bodyInput ?? "", attachments: attachmentInput, replyToMessageId: replyInput, clientMessageId: clientIdInput } : first;
  const body = input.body.trim();
  if (!input.conversationId.trim() || !body || body.length > 4000) return { ok: false, error: { code: "VALIDATION_ERROR", message: "A valid conversation and message are required." } };
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();
  if (dataSourceService.getStatus().isMock) {
    const existing = directMessageMockStore.find(input.conversationId)?.messages.find((message) => message.clientMessageId === clientMessageId);
    if (existing) return { ok: true, data: existing };
    const conversation = directMessageMockStore.find(input.conversationId); if (!conversation) return failure("Direct conversation was not found.");
    const reply = input.replyToMessageId ? conversation.messages.find((message) => message.id === input.replyToMessageId) : undefined;
    const createdAt = new Date().toISOString(); const message: DirectMessage = { id: `dm-local-${clientMessageId}`, clientMessageId, conversationId: input.conversationId, authorId: currentUserId, body, createdAt, replyToMessageId: input.replyToMessageId, replyPreview: input.replyToMessageId ? { messageId: input.replyToMessageId, authorName: reply?.authorId === currentUserId ? "You" : conversation.participantName, body: !reply ? "Message unavailable" : reply.deletedAt ? "Message deleted" : reply.body } : undefined, attachments: input.attachments };
    directMessageMockStore.replace(input.conversationId, (current) => ({ ...current, messages: [...current.messages, message], lastMessagePreview: body, updatedAt: createdAt, unreadCount: 0, archivedAt: undefined }));
    directRealtimeService.publishMock({ type: "direct_message:insert", message }); return { ok: true, data: message };
  }
  const sent = await supabaseDirectMessageService.sendDirectMessage({ conversationId: input.conversationId, body, clientMessageId, replyToMessageId: input.replyToMessageId });
  if (!sent.ok) return sent;
  if (input.attachments?.length) { const saved = await addDirectMessageAttachments(sent.data.id, input.attachments); if (!saved.ok) return saved; return { ok: true, data: { ...sent.data, attachments: saved.data } }; }
  return sent;
}

export async function editDirectMessage(messageId: string, body: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  const normalized = body.trim(); if (!normalized || normalized.length > 4000) return { ok: false, error: { code: "VALIDATION_ERROR", message: "A valid message body is required." } };
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.editDirectMessage(messageId, normalized);
  let edited: DirectMessage | undefined;
  for (const conversation of directMessageMockStore.listAll()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId || message.authorId !== currentUserId || message.deletedAt) return message; edited = { ...message, body: normalized, editedAt: new Date().toISOString() }; return edited; }), lastMessagePreview: current.messages[current.messages.length - 1]?.id === messageId ? normalized : current.lastMessagePreview }));
  if (!edited) return failure("The direct message could not be edited."); directRealtimeService.publishMock({ type: "direct_message:update", message: edited }); return { ok: true, data: edited };
}

export async function deleteDirectMessage(messageId: string): Promise<DirectMessageServiceResult<DirectMessage>> {
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.deleteDirectMessage(messageId);
  let deleted: DirectMessage | undefined;
  for (const conversation of directMessageMockStore.listAll()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId || message.authorId !== currentUserId || message.deletedAt) return message; deleted = { ...message, body: "", deletedAt: new Date().toISOString() }; return deleted; }), lastMessagePreview: current.messages[current.messages.length - 1]?.id === messageId ? "Message deleted" : current.lastMessagePreview }));
  if (!deleted) return failure("The direct message could not be deleted."); directRealtimeService.publishMock({ type: "direct_message:update", message: deleted }); return { ok: true, data: deleted };
}

async function setDirectReaction(messageId: string, emojiInput: string, add: boolean): Promise<DirectMessageServiceResult<boolean>> {
  const emoji = emojiInput.trim(); if (!messageId.trim() || !emoji) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Message and emoji are required." } };
  if (dataSourceService.getStatus().isSupabase) { const client = getSupabaseClient(); if (!client) return failure("Supabase is not configured."); const { data } = await client.auth.getUser(); if (!data.user) return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in to react to direct messages." } }; const result = add ? await client.from("direct_message_reactions").upsert({ message_id: messageId, user_id: data.user.id, emoji }, { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true }) : await client.from("direct_message_reactions").delete().eq("message_id", messageId).eq("user_id", data.user.id).eq("emoji", emoji); return result.error ? failure("The direct message reaction could not be updated.") : { ok: true, data: true }; }
  const reaction: DirectReactionRow = { id: `dm-reaction-${messageId}-${emoji}-${currentUserId}`, message_id: messageId, user_id: currentUserId, emoji, created_at: new Date().toISOString() };
  let changed = false;
  for (const conversation of directMessageMockStore.listAll()) directMessageMockStore.replace(conversation.id, (current) => ({ ...current, messages: current.messages.map((message) => { if (message.id !== messageId) return message; const reactions = [...(message.reactions ?? [])]; const index = reactions.findIndex((item) => item.emoji === emoji); if (add && index >= 0 && reactions[index].reactedByCurrentUser) return message; if (!add && (index < 0 || !reactions[index].reactedByCurrentUser)) return message; changed = true; if (add && index >= 0) reactions[index] = { ...reactions[index], count: reactions[index].count + 1, reactedByCurrentUser: true }; else if (add) reactions.push({ emoji, count: 1, reactedByCurrentUser: true }); else if (reactions[index].count > 1) reactions[index] = { ...reactions[index], count: reactions[index].count - 1, reactedByCurrentUser: false }; else reactions.splice(index, 1); return { ...message, reactions }; }) }));
  if (!changed) return { ok: true, data: true };
  directRealtimeService.publishMock({ type: add ? "direct_reaction:add" : "direct_reaction:remove", reaction }); return { ok: true, data: true };
}

export async function getDirectSharedMedia(conversationId: string, options: DirectMessagePageOptions = {}): Promise<DirectMessageServiceResult<DirectSharedMediaPage>> {
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.getDirectSharedMedia(conversationId, options);
  const conversation = directMessageMockStore.find(conversationId); if (!conversation) return failure("Direct conversation was not found.");
  const limit = normalizeLimit(options.limit, 24);
  const all = conversation.messages.flatMap((message) => (message.attachments ?? []).map((attachment) => ({ ...attachment, messageId: message.id, createdAt: attachment.createdAt ?? message.createdAt } satisfies DirectSharedMediaItem))).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const eligible = options.before ? all.filter((item) => item.createdAt < options.before!.createdAt || (item.createdAt === options.before!.createdAt && item.id < options.before!.id)) : all;
  const hasMore = eligible.length > limit; const items = eligible.slice(0, limit); const oldest = items[items.length - 1];
  return { ok: true, data: { items, hasMore, nextCursor: hasMore ? cursorFor(oldest) : undefined } };
}

export const addDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, true);
export const removeDirectReaction = (messageId: string, emoji: string) => setDirectReaction(messageId, emoji, false);
export const directMessageService = { getDirectConversations, loadDirectConversations: getDirectConversations, getDirectMessages, getDirectMessagesPage, createOrOpenDirectConversation, createDirectConversation: createOrOpenDirectConversation, sendDirectMessage, editDirectMessage, deleteDirectMessage, addDirectMessageAttachments, addDirectReaction, removeDirectReaction, markDirectConversationRead, setDirectConversationMuted, setDirectConversationArchived, getDirectSharedMedia };
