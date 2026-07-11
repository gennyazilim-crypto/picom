import { useCallback, useMemo, useState } from "react";
import type { Channel, Community, Member, Role } from "../types/community";

const FALLBACK_ROLE: Role = {
  id: "fallback-role",
  name: "Member",
  color: "var(--accent)",
  level: 0,
};

const FALLBACK_MEMBER: Member = {
  id: "fallback-member",
  userId: "fallback-user",
  displayName: "Picom User",
  username: "picom.user",
  avatarSeed: "picom-user",
  status: "offline",
  statusText: "Waiting for community data",
  roleId: FALLBACK_ROLE.id,
  bio: "Fallback desktop profile used while community data is unavailable.",
};

const FALLBACK_CHANNEL: Channel = {
  id: "fallback-channel",
  name: "no-channel",
  type: "text",
  topic: "Community data is unavailable.",
};

const FALLBACK_COMMUNITY: Community = {
  id: "fallback-community",
  kind: "text",
  name: "No communities",
  icon: "P",
  accentColor: "#007571",
  categories: [
    {
      id: "fallback-category",
      name: "Desktop",
      channels: [FALLBACK_CHANNEL],
    },
  ],
  roles: [FALLBACK_ROLE],
  members: [FALLBACK_MEMBER],
  messages: [],
};

function getChannels(community: Community) {
  return community.categories.flatMap((category) => category.channels);
}

function getFirstTextChannel(community: Community) {
  return getChannels(community).find((channel) => channel.type === "text") ?? getChannels(community)[0];
}

export function useMvpAppState(communities: Community[]) {
  const safeCommunities = useMemo(() => (communities.length > 0 ? communities : [FALLBACK_COMMUNITY]), [communities]);
  const firstCommunity = safeCommunities[0];
  const firstChannel = getFirstTextChannel(firstCommunity) ?? FALLBACK_CHANNEL;
  const [activeCommunityId, setActiveCommunityId] = useState(firstCommunity.id);
  const [activeChannelId, setActiveChannelId] = useState(firstChannel.id);

  const activeCommunity = useMemo(
    () => safeCommunities.find((community) => community.id === activeCommunityId) ?? safeCommunities[0],
    [activeCommunityId, safeCommunities],
  );
  const channels = useMemo(() => getChannels(activeCommunity), [activeCommunity]);
  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? getFirstTextChannel(activeCommunity) ?? FALLBACK_CHANNEL,
    [activeChannelId, channels],
  );

  const selectChannel = useCallback(
    (id: string) => {
      const fallbackChannel = getFirstTextChannel(activeCommunity) ?? FALLBACK_CHANNEL;
      const nextChannel = channels.find((channel) => channel.id === id) ?? fallbackChannel;
      setActiveChannelId(nextChannel.id);
    },
    [activeCommunity, channels],
  );

  const switchCommunity = useCallback(
    (id: string, preferredChannelId?: string) => {
      const community = safeCommunities.find((candidate) => candidate.id === id) ?? safeCommunities[0];
      const targetChannel = getChannels(community).find((channel) => channel.id === preferredChannelId);
      const firstTextChannel = targetChannel ?? getFirstTextChannel(community) ?? FALLBACK_CHANNEL;
      setActiveCommunityId(community.id);
      setActiveChannelId(firstTextChannel.id);
    },
    [safeCommunities],
  );

  const selectChannelByOffset = useCallback(
    (offset: number) => {
      const textChannels = channels.filter((channel: Channel) => channel.type === "text");
      const currentIndex = Math.max(0, textChannels.findIndex((channel) => channel.id === activeChannel.id));
      const next = textChannels[Math.min(textChannels.length - 1, Math.max(0, currentIndex + offset))];
      if (next) setActiveChannelId(next.id);
    },
    [activeChannel.id, channels],
  );

  return {
    activeCommunityId,
    activeChannelId: activeChannel.id,
    activeCommunity,
    channels,
    activeChannel,
    setActiveChannelId: selectChannel,
    switchCommunity,
    selectChannelByOffset,
  };
}
