import { useCallback, useState } from "react";
import type { Attachment, Channel, ChannelId, ChannelType, Community, Message, UserId } from "../types/community";

type AppendLocalMessageInput = {
  id?: string;
  communityId: string;
  channelId: string;
  authorId: UserId;
  body: string;
  createdAt?: string;
  attachments?: Attachment[];
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

  const addCommunity = useCallback((community: Community) => {
    setCommunities((current) => current.some((item) => item.id === community.id) ? current : [...current, community]);
    return community;
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

  return { communities, appendLocalMessage, addCommunity, addChannel };
}
