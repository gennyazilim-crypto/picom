import { useCallback, useState } from "react";
import type { Attachment, Channel, ChannelCategory, ChannelId, ChannelType, Community, Member, Message, UserId } from "../types/community";

type AppendLocalMessageInput = {
  id?: string;
  clientMessageId?: string | null;
  communityId: string;
  channelId: string;
  authorId: UserId;
  body: string;
  createdAt?: string;
  replyToMessageId?: string | null;
  attachments?: Attachment[];
};

type UpsertLocalMessageInput = AppendLocalMessageInput & {
  editedAt?: string | null;
  deletedAt?: string | null;
};

type UpdateLocalMessageInput = {
  communityId: string;
  channelId: string;
  id: string;
  body: string;
  editedAt?: string | null;
  deletedAt?: string | null;
};

type RemoveLocalMessageInput = {
  communityId: string;
  channelId: string;
  id: string;
};

type EditLocalMessageInput = {
  communityId: string;
  channelId: string;
  id: string;
  body: string;
};

type ToggleLocalReactionInput = {
  communityId: string;
  channelId: string;
  id: string;
  emoji: string;
};

type ChannelUnreadInput = {
  communityId: string;
  channelId: string;
  mentionCount?: number;
};

function isSameMessage(message: Message, id: string, clientMessageId?: string | null): boolean {
  return message.id === id || Boolean(clientMessageId && message.clientMessageId === clientMessageId);
}

function updateChannelUnreadState(
  communities: Community[],
  { communityId, channelId, mentionCount }: ChannelUnreadInput,
  unread: boolean,
): Community[] {
  let changed = false;
  const nextCommunities = communities.map((community) => {
    if (community.id !== communityId) return community;

    const nextCategories = community.categories.map((category) => ({
      ...category,
      channels: category.channels.map((channel) => {
        if (channel.id !== channelId) return channel;

        const nextMentions = unread ? mentionCount ?? channel.mentions ?? 0 : 0;
        if (channel.unread === unread && (channel.mentions ?? 0) === nextMentions) return channel;

        changed = true;
        return {
          ...channel,
          unread,
          mentions: nextMentions,
        };
      }),
    }));

    return changed
      ? {
      ...community,
      categories: nextCategories,
    }
      : community;
  });

  return changed ? nextCommunities : communities;
}

type AddLocalChannelInput = {
  communityId: string;
  categoryId?: string | null;
  id: ChannelId;
  name: string;
  type: ChannelType;
  topic?: string | null;
  isPrivate?: boolean;
  position?: number;
};

export function useLocalMessageState(initialCommunities: Community[]) {
  const [communities, setCommunities] = useState(initialCommunities);

  const appendLocalMessage = useCallback(({ id, clientMessageId, communityId, channelId, authorId, body, createdAt, replyToMessageId, attachments }: AppendLocalMessageInput) => {
    const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: Message = {
      id: id ?? `local-${idSuffix}`,
      clientMessageId: clientMessageId ?? null,
      channelId,
      authorId,
      body,
      createdAt: createdAt ?? new Date().toISOString(),
      replyToMessageId: replyToMessageId ?? null,
      attachments,
      reactions: [],
      localStatus: "sent",
    };

    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        const exists = community.messages.some((item) => isSameMessage(item, message.id, message.clientMessageId));
        const messages = exists
          ? community.messages.map((item) =>
              isSameMessage(item, message.id, message.clientMessageId)
                ? {
                    ...item,
                    ...message,
                    attachments: message.attachments ?? item.attachments,
                    reactions: item.reactions ?? [],
                  }
                : item,
            )
          : [...community.messages, message];

        return {
          ...community,
          messages: messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        };
      }),
    );

    return message;
  }, []);

  const upsertLocalMessage = useCallback(({ id, clientMessageId, communityId, channelId, authorId, body, createdAt, editedAt, deletedAt, attachments }: UpsertLocalMessageInput) => {
    if (!id || deletedAt) return null;

    const message: Message = {
      id,
      clientMessageId: clientMessageId ?? null,
      channelId,
      authorId,
      body,
      createdAt: createdAt ?? new Date().toISOString(),
      editedAt: editedAt ?? undefined,
      deletedAt: deletedAt ?? undefined,
      attachments,
      reactions: [],
      localStatus: "sent",
    };

    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        const exists = community.messages.some((item) => isSameMessage(item, id, clientMessageId));
        const messages = exists
          ? community.messages.map((item) =>
              isSameMessage(item, id, clientMessageId)
                ? { ...item, ...message, reactions: item.reactions ?? [], attachments: item.attachments ?? message.attachments }
                : item,
            )
          : [...community.messages, message];

        return {
          ...community,
          messages: messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        };
      }),
    );

    return message;
  }, []);

  const updateLocalMessage = useCallback(({ communityId, channelId, id, body, editedAt, deletedAt }: UpdateLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        const messages = deletedAt
          ? community.messages.filter((message) => message.id !== id)
          : community.messages.map((message) =>
              message.id === id && message.channelId === channelId
                ? { ...message, body, editedAt: editedAt ?? new Date().toISOString() }
                : message,
            );

        return { ...community, messages };
      }),
    );
  }, []);

  const removeLocalMessage = useCallback(({ communityId, channelId, id }: RemoveLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? { ...community, messages: community.messages.filter((message) => !(message.id === id && message.channelId === channelId)) }
          : community,
      ),
    );
  }, []);

  const editLocalMessage = useCallback(({ communityId, channelId, id, body }: EditLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              messages: community.messages.map((message) =>
                message.id === id && message.channelId === channelId && !message.deletedAt
                  ? { ...message, body, editedAt: new Date().toISOString() }
                  : message,
              ),
            }
          : community,
      ),
    );
  }, []);

  const deleteLocalMessage = useCallback(({ communityId, channelId, id }: RemoveLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              messages: community.messages.map((message) =>
                message.id === id && message.channelId === channelId
                  ? {
                      ...message,
                      body: "",
                      deletedAt: new Date().toISOString(),
                      editedAt: undefined,
                      attachments: [],
                      reactions: [],
                    }
                  : message,
              ),
            }
          : community,
      ),
    );
  }, []);

  const toggleLocalReaction = useCallback(({ communityId, channelId, id, emoji }: ToggleLocalReactionInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              messages: community.messages.map((message) => {
                if (message.id !== id || message.channelId !== channelId || message.deletedAt) return message;

                const reactions = message.reactions ?? [];
                const existing = reactions.find((reaction) => reaction.emoji === emoji);

                if (!existing) {
                  return {
                    ...message,
                    reactions: [...reactions, { emoji, count: 1, reactedByCurrentUser: true }],
                  };
                }

                const nextCount = existing.count + (existing.reactedByCurrentUser ? -1 : 1);
                const nextReactions = reactions
                  .map((reaction) =>
                    reaction.emoji === emoji
                      ? { ...reaction, count: Math.max(0, nextCount), reactedByCurrentUser: !reaction.reactedByCurrentUser }
                      : reaction,
                  )
                  .filter((reaction) => reaction.count > 0);

                return { ...message, reactions: nextReactions };
              }),
            }
          : community,
      ),
    );
  }, []);

  const markChannelUnread = useCallback((input: ChannelUnreadInput) => {
    setCommunities((current) => updateChannelUnreadState(current, input, true));
  }, []);

  const clearChannelUnread = useCallback((input: ChannelUnreadInput) => {
    setCommunities((current) => updateChannelUnreadState(current, input, false));
  }, []);

  const addCommunity = useCallback((community: Community) => {
    setCommunities((current) => current.some((item) => item.id === community.id) ? current : [...current, community]);
    return community;
  }, []);

  const replaceCommunities = useCallback((nextCommunities: Community[]) => {
    setCommunities(nextCommunities);
    return nextCommunities;
  }, []);

  const replaceCommunityCategories = useCallback((communityId: string, categories: ChannelCategory[]) => {
    setCommunities((current) =>
      current.map((community) => community.id === communityId ? { ...community, categories } : community),
    );
  }, []);

  const replaceChannelMessages = useCallback((communityId: string, channelId: string, messages: Message[]) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              messages: [
                ...community.messages.filter((message) => message.channelId !== channelId),
                ...messages,
              ],
            }
          : community,
      ),
    );
  }, []);

  const replaceCommunityMembers = useCallback((communityId: string, members: Member[]) => {
    setCommunities((current) =>
      current.map((community) => community.id === communityId ? { ...community, members } : community),
    );
  }, []);

  const addChannel = useCallback((input: AddLocalChannelInput) => {
    const channel: Channel = {
      id: input.id,
      name: input.name,
      type: input.type,
      topic: input.topic ?? undefined,
      isPrivate: input.isPrivate,
      categoryId: input.categoryId ?? undefined,
      position: input.position,
    };

    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== input.communityId) return community;

        const fallbackCategoryId = community.categories[0]?.id;
        const targetCategoryId = input.categoryId ?? fallbackCategoryId;

        return {
          ...community,
          categories: community.categories.map((category) =>
            category.id === targetCategoryId
              ? { ...category, channels: [...category.channels, { ...channel, categoryId: category.id }] }
              : category,
          ),
        };
      }),
    );

    return channel;
  }, []);

  return {
    communities,
    appendLocalMessage,
    upsertLocalMessage,
    updateLocalMessage,
    removeLocalMessage,
    editLocalMessage,
    deleteLocalMessage,
    toggleLocalReaction,
    markChannelUnread,
    clearChannelUnread,
    addCommunity,
    addChannel,
    replaceCommunities,
    replaceCommunityCategories,
    replaceChannelMessages,
    replaceCommunityMembers,
  };
}
