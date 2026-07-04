import { useCallback, useMemo, useState } from "react";
import type { Channel, Community } from "../types/community";

function getChannels(community: Community) {
  return community.categories.flatMap((category) => category.channels);
}

function getFirstTextChannel(community: Community) {
  return getChannels(community).find((channel) => channel.type === "text") ?? getChannels(community)[0];
}

export function useMvpAppState(communities: Community[]) {
  const firstCommunity = communities[0];
  const firstChannel = getFirstTextChannel(firstCommunity);
  const [activeCommunityId, setActiveCommunityId] = useState(firstCommunity.id);
  const [activeChannelId, setActiveChannelId] = useState(firstChannel.id);

  const activeCommunity = useMemo(
    () => communities.find((community) => community.id === activeCommunityId) ?? communities[0],
    [activeCommunityId, communities],
  );
  const channels = useMemo(() => getChannels(activeCommunity), [activeCommunity]);
  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? channels[0],
    [activeChannelId, channels],
  );

  const switchCommunity = useCallback(
    (id: string) => {
      const community = communities.find((candidate) => candidate.id === id);
      const firstTextChannel = community ? getFirstTextChannel(community) : undefined;
      setActiveCommunityId(id);
      if (firstTextChannel) setActiveChannelId(firstTextChannel.id);
    },
    [communities],
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
    activeChannelId,
    activeCommunity,
    channels,
    activeChannel,
    setActiveChannelId,
    switchCommunity,
    selectChannelByOffset,
  };
}