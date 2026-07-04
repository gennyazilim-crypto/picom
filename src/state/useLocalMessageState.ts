import { useCallback, useState } from "react";
import type { Attachment, Channel, ChannelCategory, ChannelId, ChannelType, Community, Member, Message, UserId } from "../types/community";

type AppendLocalMessageInput = {
  id?: string;
  communityId: string;
  channelId: string;
  authorId: UserId;
  body: string;
  createdAt?: string;
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

  const appendLocalMessage = useCallback(({ id, communityId, channelId, authorId, body, createdAt, attachments }: AppendLocalMessageInput) => {
    const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: Message = {
      id: id ?? `local-${idSuffix}`,
      channelId,
      authorId,
      body,
      createdAt: createdAt ?? new Date().toISOString(),
      attachments,
      reactions: [],
      localStatus: "sent",
    };

    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId ? { ...community, messages: [...community.messages, message] } : community,
      ),
    );

    return message;
  }, []);

  const upsertLocalMessage = useCallback(({ id, communityId, channelId, authorId, body, createdAt, editedAt, deletedAt, attachments }: UpsertLocalMessageInput) => {
    if (!id || deletedAt) return null;

    const message: Message = {
      id,
      channelId,
      authorId,
      body,
      createdAt: createdAt ?? new Date().toISOString(),
      editedAt: editedAt ?? undefined,
      attachments,
      reactions: [],
      localStatus: "sent",
    };

    setCommunities((current) =>
      current.map((community) => {
        if (community.id !== communityId) return community;

        const exists = community.messages.some((item) => item.id === id);
        const messages = exists
          ? community.messages.map((item) => item.id === id ? { ...item, ...message, reactions: item.reactions ?? [], attachments: item.attachments ?? message.attachments } : item)
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
    addCommunity,
    addChannel,
    replaceCommunities,
    replaceCommunityCategories,
    replaceChannelMessages,
    replaceCommunityMembers,
  };
}
