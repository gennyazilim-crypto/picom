import { useCallback, useState } from "react";
import type { Attachment, Channel, ChannelCategory, ChannelId, ChannelType, Community, Member, Message, Role, UserId } from "../types/community";
import type { PollData } from "../types/polls";
import { isCommunityIconImage } from "../utils/generatedIdentity";

type AppendLocalMessageInput = {
  id?: string;
  clientMessageId?: string | null;
  communityId: string;
  channelId: string;
  authorId: UserId;
  body: string;
  sequence?: number | null;
  localOrder?: number;
  createdAt?: string;
  replyToMessageId?: string | null;
  attachments?: Attachment[];
  poll?: PollData;
  localStatus?: Message["localStatus"];
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

type SetLocalMessageDeliveryStatusInput = RemoveLocalMessageInput & {
  clientMessageId?: string | null;
  localStatus: NonNullable<Message["localStatus"]>;
};

type EditLocalMessageInput = {
  communityId: string;
  channelId: string;
  id: string;
  body: string;
  editedAt?: string | null;
};

type ToggleLocalReactionInput = {
  communityId: string;
  channelId: string;
  id: string;
  emoji: string;
};

type SetLocalReactionSummaryInput = ToggleLocalReactionInput & {
  count: number;
  reactedByCurrentUser: boolean;
};

type ChannelUnreadInput = {
  communityId: string;
  channelId: string;
  mentionCount?: number;
};

export type ChannelUnreadSnapshot = {
  channelId: string;
  unread: boolean;
  mentionCount: number;
};

function isSameMessage(message: Message, id: string, clientMessageId?: string | null): boolean {
  return message.id === id || Boolean(clientMessageId && message.clientMessageId === clientMessageId);
}

function shouldKeepDeletedMessage(existing: Message, incoming: Message): boolean {
  return Boolean(existing.deletedAt && !incoming.deletedAt);
}

function compareMessagesByDisplayOrder(left: Message, right: Message): number {
  if (
    left.channelId === right.channelId &&
    typeof left.sequence === "number" &&
    typeof right.sequence === "number" &&
    left.sequence !== right.sequence
  ) {
    return left.sequence - right.sequence;
  }

  if (left.channelId === right.channelId && (typeof left.localOrder === "number" || typeof right.localOrder === "number")) {
    const leftOrder = left.localOrder ?? 0;
    const rightOrder = right.localOrder ?? 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }

  const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
  return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
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

        const nextMentions = unread ? Math.max(0, (channel.mentions ?? 0) + (mentionCount ?? 0)) : 0;
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

type AddLocalCategoryInput = {
  communityId: string;
  id?: string;
  name: string;
  position?: number;
};

type RenameLocalCategoryInput = {
  communityId: string;
  categoryId: string;
  name: string;
};

type DeleteLocalCategoryInput = {
  communityId: string;
  categoryId: string;
};

type MoveLocalCategoryInput = {
  communityId: string;
  categoryId: string;
  direction: "up" | "down";
};

type MoveLocalChannelInput = {
  communityId: string;
  categoryId: string;
  channelId: string;
  direction: "up" | "down";
};

type AddLocalChannelInput = {
  communityId: string;
  categoryId?: string | null;
  id: ChannelId;
  name: string;
  type: ChannelType;
  topic?: string | null;
  isPrivate?: boolean;
  publicReadEnabled?: boolean;
  position?: number;
};

export function useLocalMessageState(initialCommunities: Community[]) {
  const [communities, setCommunities] = useState(initialCommunities);

  const appendLocalMessage = useCallback(({ id, clientMessageId, communityId, channelId, authorId, body, sequence, localOrder, createdAt, replyToMessageId, attachments, poll, localStatus }: AppendLocalMessageInput) => {
    const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: Message = {
      id: id ?? `local-${idSuffix}`,
      clientMessageId: clientMessageId ?? null,
      sequence: sequence ?? null,
      localOrder,
      channelId,
      authorId,
      body,
      createdAt: createdAt ?? new Date().toISOString(),
      replyToMessageId: replyToMessageId ?? null,
      attachments,
      poll,
      reactions: [],
      localStatus: localStatus ?? "sent",
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
          messages: messages.sort(compareMessagesByDisplayOrder),
        };
      }),
    );

    return message;
  }, []);

  const upsertLocalMessage = useCallback(({ id, clientMessageId, communityId, channelId, authorId, body, sequence, localOrder, createdAt, editedAt, deletedAt, attachments }: UpsertLocalMessageInput) => {
    if (!id || deletedAt) return null;

    const message: Message = {
      id,
      clientMessageId: clientMessageId ?? null,
      sequence: sequence ?? null,
      localOrder,
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
                ? shouldKeepDeletedMessage(item, message)
                  ? item
                  : { ...item, ...message, reactions: item.reactions ?? [], attachments: item.attachments ?? message.attachments }
                : item,
            )
          : [...community.messages, message];

        return {
          ...community,
          messages: messages.sort(compareMessagesByDisplayOrder),
        };
      }),
    );

    return message;
  }, []);

  const updateLocalMessage = useCallback(({ communityId, channelId, id, body, editedAt, deletedAt }: UpdateLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        const messages = community.messages.map((message) => {
          if (message.id !== id || message.channelId !== channelId) return message;
          if (deletedAt) return { ...message, body: "", editedAt: undefined, deletedAt, attachments: [], reactions: [] };
          if (message.deletedAt) return message;
          return { ...message, body, editedAt: editedAt === null ? undefined : editedAt ?? new Date().toISOString() };
        });

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

  const setLocalMessageDeliveryStatus = useCallback(({ communityId, channelId, id, clientMessageId, localStatus }: SetLocalMessageDeliveryStatusInput) => {
    setCommunities((current) => current.map((community) => community.id !== communityId ? community : {
      ...community,
      messages: community.messages.map((message) => message.channelId === channelId && isSameMessage(message, id, clientMessageId) ? { ...message, localStatus } : message),
    }));
  }, []);

  const editLocalMessage = useCallback(({ communityId, channelId, id, body, editedAt }: EditLocalMessageInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              messages: community.messages.map((message) =>
                message.id === id && message.channelId === channelId && !message.deletedAt
                  ? { ...message, body, editedAt: editedAt === null ? undefined : editedAt ?? new Date().toISOString() }
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
              // Match by id only: message ids are unique across the community, and realtime
              // DELETE payloads carry just the id (no channel), so a channel condition would
              // silently drop hard-deletes for any channel other than the active one.
              messages: community.messages.map((message) =>
                message.id === id
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

  const setLocalReactionSummary = useCallback(({ communityId, channelId, id, emoji, count, reactedByCurrentUser }: SetLocalReactionSummaryInput) => {
    setCommunities((current) => current.map((community) => community.id !== communityId ? community : {
      ...community,
      messages: community.messages.map((message) => {
        if (message.id !== id || message.channelId !== channelId || message.deletedAt) return message;
        const remaining = (message.reactions ?? []).filter((reaction) => reaction.emoji !== emoji);
        const next = count > 0 ? [...remaining, { emoji, count, reactedByCurrentUser }] : remaining;
        return { ...message, reactions: next.sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji)).slice(0, 8) };
      }),
    }));
  }, []);

  const markChannelUnread = useCallback((input: ChannelUnreadInput) => {
    setCommunities((current) => updateChannelUnreadState(current, input, true));
  }, []);

  const clearChannelUnread = useCallback((input: ChannelUnreadInput) => {
    setCommunities((current) => updateChannelUnreadState(current, input, false));
  }, []);

  const setCommunityUnreadState = useCallback((communityId: string, snapshots: ChannelUnreadSnapshot[]) => {
    const snapshotByChannelId = new Map(snapshots.map((snapshot) => [snapshot.channelId, snapshot]));
    setCommunities((current) => current.map((community) => community.id !== communityId ? community : {
      ...community,
      categories: community.categories.map((category) => ({
        ...category,
        channels: category.channels.map((channel) => {
          const snapshot = snapshotByChannelId.get(channel.id);
          if (!snapshot) return channel;
          if (channel.unread === snapshot.unread && (channel.mentions ?? 0) === snapshot.mentionCount) return channel;
          return { ...channel, unread: snapshot.unread, mentions: snapshot.mentionCount };
        }),
      })),
    }));
  }, []);

  const addCommunity = useCallback((community: Community) => {
    setCommunities((current) => current.some((item) => item.id === community.id) ? current : [...current, community]);
    return community;
  }, []);

  const replaceCommunities = useCallback((nextCommunities: Community[]) => {
    setCommunities((current) => {
      const previousById = new Map(current.map((community) => [community.id, community]));
      return nextCommunities.map((next) => {
        const previous = previousById.get(next.id);
        if (!previous) return next;
        // Supabase list payloads ship without sidebar categories; keep any already-hydrated channel tree.
        const categories = next.categories.length > 0 ? next.categories : previous.categories;
        const messages = next.messages.length > 0 ? next.messages : previous.messages;
        const members = next.members.length > 1 || !previous.members.length ? next.members : previous.members;
        // Keep a previously resolved logo URL if the list payload briefly omits icon_url.
        const icon =
          isCommunityIconImage(next.icon) || !isCommunityIconImage(previous.icon)
            ? next.icon
            : previous.icon;
        return { ...next, icon, categories, messages, members };
      });
    });
    return nextCommunities;
  }, []);

  const patchCommunity = useCallback((communityId: string, patch: Partial<Community>) => {
    setCommunities((current) =>
      current.map((community) => (community.id === communityId ? { ...community, ...patch } : community)),
    );
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

  const replaceCommunityRoles = useCallback((communityId: string, roles: Role[]) => {
    setCommunities((current) =>
      current.map((community) => community.id === communityId ? { ...community, roles } : community),
    );
  }, []);

  const addCategory = useCallback((input: AddLocalCategoryInput) => {
    const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const category: ChannelCategory = {
      id: input.id ?? `local-category-${idSuffix}`,
      name: input.name.trim(),
      channels: [],
      position: input.position,
    };

    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== input.communityId) return community;
        return {
          ...community,
          categories: [...community.categories, { ...category, position: category.position ?? community.categories.length }],
        };
      }),
    );

    return category;
  }, []);

  const renameCategory = useCallback(({ communityId, categoryId, name }: RenameLocalCategoryInput) => {
    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId
          ? {
              ...community,
              categories: community.categories.map((category) => category.id === categoryId ? { ...category, name: name.trim() } : category),
            }
          : community,
      ),
    );
  }, []);

  const deleteCategory = useCallback(({ communityId, categoryId }: DeleteLocalCategoryInput) => {
    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId || community.categories.length <= 1) return community;

        const target = community.categories.find((category) => category.id === categoryId);
        if (!target) return community;

        const remaining = community.categories.filter((category) => category.id !== categoryId);
        const [firstCategory, ...otherCategories] = remaining;
        if (!firstCategory) return community;

        const movedChannels = target.channels.map((channel) => ({ ...channel, categoryId: firstCategory.id }));

        return {
          ...community,
          categories: [
            { ...firstCategory, channels: [...firstCategory.channels, ...movedChannels] },
            ...otherCategories,
          ].map((category, position) => ({ ...category, position })),
        };
      }),
    );
  }, []);

  const moveCategory = useCallback(({ communityId, categoryId, direction }: MoveLocalCategoryInput) => {
    setCommunities((current) => current.map((community) => {
      if (community.id !== communityId) return community;
      const currentIndex = community.categories.findIndex((category) => category.id === categoryId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= community.categories.length) return community;
      const categories = [...community.categories];
      const [category] = categories.splice(currentIndex, 1);
      categories.splice(targetIndex, 0, category);
      return { ...community, categories: categories.map((item, position) => ({ ...item, position })) };
    }));
  }, []);


  const moveChannel = useCallback(({ communityId, categoryId, channelId, direction }: MoveLocalChannelInput) => {
    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        return {
          ...community,
          categories: community.categories.map((category) => {
            if (category.id !== categoryId) return category;

            const currentIndex = category.channels.findIndex((channel) => channel.id === channelId);
            if (currentIndex < 0) return category;

            const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= category.channels.length) return category;

            const nextChannels = [...category.channels];
            const [channel] = nextChannels.splice(currentIndex, 1);
            nextChannels.splice(targetIndex, 0, channel);

            return {
              ...category,
              channels: nextChannels.map((item, position) => ({ ...item, position })),
            };
          }),
        };
      }),
    );
  }, []);
  const addChannel = useCallback((input: AddLocalChannelInput) => {
    const channel: Channel = {
      id: input.id,
      name: input.name,
      type: input.type,
      topic: input.topic ?? undefined,
      isPrivate: input.isPrivate,
      publicReadEnabled: input.publicReadEnabled,
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
    setLocalMessageDeliveryStatus,
    editLocalMessage,
    deleteLocalMessage,
    toggleLocalReaction,
    setLocalReactionSummary,
    markChannelUnread,
    clearChannelUnread,
    setCommunityUnreadState,
    addCommunity,
    addCategory,
    renameCategory,
    deleteCategory,
    moveCategory,
    moveChannel,
    addChannel,
    replaceCommunities,
    patchCommunity,
    replaceCommunityCategories,
    replaceChannelMessages,
    replaceCommunityMembers,
    replaceCommunityRoles,
  };
}
