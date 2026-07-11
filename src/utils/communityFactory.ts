import { currentUserId } from "../data/mockCommunities";
import { mockRoles } from "../data/mockMembers";
import { getCommunityTemplate } from "../data/communityTemplates";
import type { CommunitySummary } from "../services/communityService";
import { supportsTextChannels, type ChannelCategory, type Community, type Role } from "../types/community";

function getIcon(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

export function createCommunityFromSummary(summary: CommunitySummary): Community {
  const template = getCommunityTemplate(summary.templateId);
  const radioRoles: Role[] = [
    { id: `${summary.id}-owner-role`, name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "hostRadio", "manageRadioSchedule", "manageRadioPrograms", "publishRadioAnnouncements"] },
    { id: `${summary.id}-radio-host-role`, name: "Radio Host", color: "var(--picom-aqua)", level: 50, capabilities: ["hostRadio", "manageRadioSchedule"] },
    { id: `${summary.id}-member-role`, name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["listenRadio"] },
  ];
  const podcastRoles: Role[] = [
    { id: `${summary.id}-owner-role`, name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "publishPodcasts", "managePodcastSeries", "editAnyPodcast", "moderatePodcastComments"] },
    { id: `${summary.id}-podcast-publisher-role`, name: "Podcast Publisher", color: "var(--picom-aqua)", level: 50, capabilities: ["publishPodcasts", "managePodcastSeries"] },
    { id: `${summary.id}-podcast-editor-role`, name: "Podcast Editor", color: "var(--picom-orange)", level: 40, capabilities: ["editPodcastMetadata", "moderatePodcastComments"] },
    { id: `${summary.id}-member-role`, name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["listenPodcasts"] },
  ];
  const roles = summary.kind === "radio" ? radioRoles : summary.kind === "podcast" ? podcastRoles : mockRoles;
  const ownerRole = roles.find((role) => role.name === "Owner") ?? roles[0];
  const categories: ChannelCategory[] = (supportsTextChannels(summary.kind) ? template.categories : []).map((category, categoryIndex) => {
    const categoryId = `${summary.id}-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "category"}`;

    return {
      id: categoryId,
      name: category.name,
      position: categoryIndex,
      channels: category.channels.map((channel, channelIndex) => ({
        id: `${summary.id}-${channel.name}`,
        categoryId,
        name: channel.name,
        type: channel.type,
        topic: channel.topic ?? summary.description ?? template.welcomeMessage,
        isPrivate: channel.isPrivate,
        publicReadEnabled: !channel.isPrivate,
        position: channelIndex,
      })),
    };
  });

  return {
    id: summary.id,
    kind: summary.kind,
    ownerId: summary.ownerId ?? undefined,
    name: summary.name,
    icon: getIcon(summary.name),
    accentColor: summary.accentColor || template.accentColor,
    description: summary.description,
    visibility: summary.visibility,
    publicReadEnabled: summary.publicReadEnabled,
    roles,
    members: [
      {
        id: `${summary.id}-owner-member`,
        userId: currentUserId,
        displayName: "Picom User",
        username: "picom.user",
        avatarSeed: `${summary.id}-owner`,
        status: "online",
        statusText: "Setting up the community",
        roleId: ownerRole.id,
        bio: "Community owner placeholder for the MVP create flow.",
      },
    ],
    categories,
    messages: [],
  };
}
