import type {
  CategoryId,
  Channel,
  ChannelCategory,
  ChannelId,
  Community,
  CommunityId,
  Member,
  MemberId,
  Message,
  MessageId,
  Role,
  RoleId,
  UserId,
} from "../types/community";

export type NormalizedEntityStore = {
  communityIds: CommunityId[];
  communitiesById: Record<CommunityId, Community>;
  categoryIdsByCommunityId: Record<CommunityId, CategoryId[]>;
  categoriesById: Record<CategoryId, ChannelCategory>;
  channelIdsByCommunityId: Record<CommunityId, ChannelId[]>;
  channelIdsByCategoryId: Record<CategoryId, ChannelId[]>;
  channelsById: Record<ChannelId, Channel>;
  memberIdsByCommunityId: Record<CommunityId, MemberId[]>;
  membersById: Record<MemberId, Member>;
  memberIdsByUserId: Record<UserId, MemberId[]>;
  roleIdsByCommunityId: Record<CommunityId, RoleId[]>;
  rolesById: Record<RoleId, Role>;
  messageIdsByChannelId: Record<ChannelId, MessageId[]>;
  messagesById: Record<MessageId, Message>;
};

function sortIdsByPosition<T extends { id: string; position?: number }>(items: readonly T[]): string[] {
  return [...items]
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0) || left.id.localeCompare(right.id))
    .map((item) => item.id);
}

function sortMessageIds(messages: readonly Message[]): MessageId[] {
  return [...messages]
    .sort((left, right) => {
      if (
        left.channelId === right.channelId &&
        typeof left.sequence === "number" &&
        typeof right.sequence === "number" &&
        left.sequence !== right.sequence
      ) {
        return left.sequence - right.sequence;
      }

      const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
      return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
    })
    .map((message) => message.id);
}

export function createNormalizedEntityStore(communities: readonly Community[]): NormalizedEntityStore {
  const store: NormalizedEntityStore = {
    communityIds: communities.map((community) => community.id),
    communitiesById: {},
    categoryIdsByCommunityId: {},
    categoriesById: {},
    channelIdsByCommunityId: {},
    channelIdsByCategoryId: {},
    channelsById: {},
    memberIdsByCommunityId: {},
    membersById: {},
    memberIdsByUserId: {},
    roleIdsByCommunityId: {},
    rolesById: {},
    messageIdsByChannelId: {},
    messagesById: {},
  };

  for (const community of communities) {
    store.communitiesById[community.id] = community;
    store.categoryIdsByCommunityId[community.id] = sortIdsByPosition(community.categories);
    store.channelIdsByCommunityId[community.id] = [];
    store.memberIdsByCommunityId[community.id] = community.members.map((member) => member.id);
    store.roleIdsByCommunityId[community.id] = community.roles.map((role) => role.id);

    for (const role of community.roles) {
      store.rolesById[role.id] = role;
    }

    for (const member of community.members) {
      store.membersById[member.id] = member;
      store.memberIdsByUserId[member.userId] = [...(store.memberIdsByUserId[member.userId] ?? []), member.id];
    }

    for (const category of community.categories) {
      store.categoriesById[category.id] = category;
      store.channelIdsByCategoryId[category.id] = sortIdsByPosition(category.channels);

      for (const channel of category.channels) {
        store.channelsById[channel.id] = channel;
        store.channelIdsByCommunityId[community.id].push(channel.id);
      }
    }

    for (const message of community.messages) {
      store.messagesById[message.id] = message;
      store.messageIdsByChannelId[message.channelId] = [...(store.messageIdsByChannelId[message.channelId] ?? []), message.id];
    }
  }

  for (const [channelId, messageIds] of Object.entries(store.messageIdsByChannelId)) {
    const messages = messageIds.map((messageId) => store.messagesById[messageId]).filter((message): message is Message => Boolean(message));
    store.messageIdsByChannelId[channelId] = sortMessageIds(messages);
  }

  return store;
}

export function selectCommunity(store: NormalizedEntityStore, communityId: CommunityId): Community | null {
  return store.communitiesById[communityId] ?? null;
}

export function selectChannelsForCommunity(store: NormalizedEntityStore, communityId: CommunityId): Channel[] {
  return (store.channelIdsByCommunityId[communityId] ?? [])
    .map((channelId) => store.channelsById[channelId])
    .filter((channel): channel is Channel => Boolean(channel));
}

export function selectMessagesForChannel(store: NormalizedEntityStore, channelId: ChannelId): Message[] {
  return (store.messageIdsByChannelId[channelId] ?? [])
    .map((messageId) => store.messagesById[messageId])
    .filter((message): message is Message => Boolean(message));
}

export function selectMembersForCommunity(store: NormalizedEntityStore, communityId: CommunityId): Member[] {
  return (store.memberIdsByCommunityId[communityId] ?? [])
    .map((memberId) => store.membersById[memberId])
    .filter((member): member is Member => Boolean(member));
}

export function selectRolesForCommunity(store: NormalizedEntityStore, communityId: CommunityId): Role[] {
  return (store.roleIdsByCommunityId[communityId] ?? [])
    .map((roleId) => store.rolesById[roleId])
    .filter((role): role is Role => Boolean(role));
}
