import { useCallback, useEffect, useMemo, useState } from "react";
import type { Channel, Community, Member, Role } from "../types/community";
import { supportsTextChannels } from "../types/community";
import { communityNavigationService } from "../services/community/communityNavigationService";

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
  if (!supportsTextChannels(community)) return undefined;
  return getChannels(community).find((channel) => channel.type === "text") ?? getChannels(community)[0];
}

function getShellChannel(community: Community): Channel {
  return {
    id: communityNavigationService.getShellChannelId(community),
    name: `${community.kind}-shell`,
    type: "text",
    topic: `${community.name} uses its dedicated ${community.kind} navigation.`,
  };
}

export function useMvpAppState(communities: Community[]) {
  const safeCommunities = useMemo(() => (communities.length > 0 ? communities : [FALLBACK_COMMUNITY]), [communities]);
  const firstCommunity = safeCommunities[0];
  const firstChannel = getFirstTextChannel(firstCommunity) ?? (firstCommunity.kind === "text" ? FALLBACK_CHANNEL : getShellChannel(firstCommunity));
  const [activeCommunityId, setActiveCommunityId] = useState(firstCommunity.id);
  const [activeChannelId, setActiveChannelId] = useState(firstChannel.id);

  const activeCommunity = useMemo(
    () => safeCommunities.find((community) => community.id === activeCommunityId) ?? safeCommunities[0],
    [activeCommunityId, safeCommunities],
  );
  const channels = useMemo(() => getChannels(activeCommunity), [activeCommunity]);
  const activeChannel = useMemo(
    () => activeCommunity.kind === "text"
      ? channels.find((channel) => channel.id === activeChannelId) ?? channels.find((channel) => channel.id === communityNavigationService.resolveTextChannelId(activeCommunity)) ?? FALLBACK_CHANNEL
      : getShellChannel(activeCommunity),
    [activeChannelId, activeCommunity, channels],
  );

  useEffect(() => {
    const selectedCommunity = safeCommunities.find((community) => community.id === activeCommunityId);
    const nextCommunity = selectedCommunity ?? safeCommunities[0];
    if (!nextCommunity) return;

    const nextChannelId = communityNavigationService.resolveTextChannelId(nextCommunity, activeChannelId)
      ?? (nextCommunity.kind === "text" ? FALLBACK_CHANNEL.id : communityNavigationService.getShellChannelId(nextCommunity));

    if (nextCommunity.id !== activeCommunityId) setActiveCommunityId(nextCommunity.id);
    if (nextChannelId !== activeChannelId) setActiveChannelId(nextChannelId);
  }, [activeChannelId, activeCommunityId, safeCommunities]);

  const selectChannel = useCallback(
    (id: string) => {
      if (activeCommunity.kind !== "text") return;
      const nextChannelId = communityNavigationService.resolveTextChannelId(activeCommunity, id);
      if (!nextChannelId) return;
      communityNavigationService.rememberTextChannel(activeCommunity, nextChannelId);
      setActiveChannelId(nextChannelId);
    },
    [activeCommunity, channels],
  );

  const switchCommunity = useCallback(
    (id: string, preferredChannelId?: string) => {
      if (activeCommunity.kind === "text") communityNavigationService.rememberTextChannel(activeCommunity, activeChannelId);
      const community = safeCommunities.find((candidate) => candidate.id === id) ?? safeCommunities[0];
      const targetChannelId = communityNavigationService.resolveTextChannelId(community, preferredChannelId);
      setActiveCommunityId(community.id);
      if (targetChannelId) {
        communityNavigationService.rememberTextChannel(community, targetChannelId);
        setActiveChannelId(targetChannelId);
      } else {
        setActiveChannelId(community.kind === "text" ? FALLBACK_CHANNEL.id : communityNavigationService.getShellChannelId(community));
      }
    },
    [activeChannelId, activeCommunity, safeCommunities],
  );

  const selectChannelByOffset = useCallback(
    (offset: number) => {
      const textChannels = channels.filter((channel: Channel) => channel.type === "text");
      const currentIndex = Math.max(0, textChannels.findIndex((channel) => channel.id === activeChannel.id));
      const next = textChannels[Math.min(textChannels.length - 1, Math.max(0, currentIndex + offset))];
      if (next) {
        communityNavigationService.rememberTextChannel(activeCommunity, next.id);
        setActiveChannelId(next.id);
      }
    },
    [activeChannel.id, activeCommunity, channels],
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
