import { mockDirectConversations } from "../../data/mockDirectMessages";
import type { DirectConversation } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import { directMessageService as supabaseDirectMessageService, type DirectMessageServiceResult } from "../supabase/directMessageService";

function cloneConversation(conversation: DirectConversation): DirectConversation {
  return { ...conversation, messages: conversation.messages.map((message) => ({ ...message, attachments: message.attachments?.map((attachment) => ({ ...attachment })), reactions: message.reactions?.map((reaction) => ({ ...reaction })), replyPreview: message.replyPreview ? { ...message.replyPreview } : undefined })), mutualCommunities: conversation.mutualCommunities?.map((community) => ({ ...community })), sharedMedia: conversation.sharedMedia?.map((media) => ({ ...media })) };
}

let mockConversations = mockDirectConversations.map(cloneConversation);

export const directMessageMockStore = {
  list(): DirectConversation[] { return mockConversations.map(cloneConversation); },
  find(conversationId: string): DirectConversation | undefined { const conversation = mockConversations.find((item) => item.id === conversationId); return conversation ? cloneConversation(conversation) : undefined; },
  replace(conversationId: string, update: (conversation: DirectConversation) => DirectConversation): DirectConversation | undefined { const index = mockConversations.findIndex((item) => item.id === conversationId); if (index < 0) return undefined; mockConversations[index] = update(mockConversations[index]); return cloneConversation(mockConversations[index]); },
  prepend(conversation: DirectConversation): void { mockConversations = [cloneConversation(conversation), ...mockConversations.filter((item) => item.id !== conversation.id)]; },
};

export async function getDirectConversations(): Promise<DirectMessageServiceResult<DirectConversation[]>> {
  if (dataSourceService.getStatus().isMock) return { ok: true, data: directMessageMockStore.list() };
  return supabaseDirectMessageService.loadDirectConversations();
}

export async function createOrOpenDirectConversation(userId: string): Promise<DirectMessageServiceResult<string>> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Participant is required." } };
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.createDirectConversation(normalizedUserId);
  const existing = directMessageMockStore.list().find((conversation) => conversation.participantUserId === normalizedUserId);
  if (existing) return { ok: true, data: existing.id };
  const conversation: DirectConversation = { id: `dm-${normalizedUserId}`, participantUserId: normalizedUserId, participantName: "Picom member", participantUsername: normalizedUserId, participantStatus: "offline", participantStatusText: "Offline", lastMessagePreview: "Start a conversation", updatedAt: new Date().toISOString(), unreadCount: 0, messages: [] };
  directMessageMockStore.prepend(conversation);
  return { ok: true, data: conversation.id };
}

export async function markDirectConversationRead(conversationId: string): Promise<boolean> {
  if (!conversationId.trim()) return false;
  if (dataSourceService.getStatus().isSupabase) return supabaseDirectMessageService.markDirectConversationRead(conversationId);
  return Boolean(directMessageMockStore.replace(conversationId, (conversation) => ({ ...conversation, unreadCount: 0 })));
}

export const directConversationService = { getDirectConversations, createOrOpenDirectConversation, markDirectConversationRead };
