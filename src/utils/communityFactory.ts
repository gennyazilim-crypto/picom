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
    { id: `${summary.id}-owner-role`, name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "publishRadioAnnouncements", "moderateRadioComments"] },
    { id: `${summary.id}-radio-host-role`, name: "Radio Host", color: "var(--picom-aqua)", level: 50, capabilities: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioSchedule", "manageRadioPrograms"] },
    { id: `${summary.id}-member-role`, name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["viewRadioContent", "listenRadio"] },
  ];
  const podcastRoles: Role[] = [
    { id: `${summary.id}-owner-role`, name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "moderatePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity"] },
    { id: `${summary.id}-podcast-publisher-role`, name: "Podcast Publisher", color: "var(--picom-aqua)", level: 50, capabilities: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts"] },
    { id: `${summary.id}-podcast-editor-role`, name: "Podcast Editor", color: "var(--picom-orange)", level: 40, capabilities: ["viewPodcastContent", "listenPodcasts", "editPodcastMetadata", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments"] },
    { id: `${summary.id}-member-role`, name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts"] },
  ];
  const roles = summary.kind === "radio" ? radioRoles : summary.kind === "podcast" ? podcastRoles : mockRoles;
  const ownerRole = roles.find((role) => role.name === "Owner") ?? roles[0];
  const ownerUserId = summary.ownerId ?? currentUserId;
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
        userId: ownerUserId,
        displayName: "Picom User",
        username: "picom.user",
        avatarSeed: ownerUserId,
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
