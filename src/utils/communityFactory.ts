import { currentUserId } from "../data/mockCommunities";
import { mockRoles } from "../data/mockMembers";
import { getCommunityTemplate } from "../data/communityTemplates";
import type { CommunitySummary } from "../services/communityService";
import type { ChannelCategory, Community } from "../types/community";

function getIcon(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

export function createCommunityFromSummary(summary: CommunitySummary): Community {
  const template = getCommunityTemplate(summary.templateId);
  const ownerRole = mockRoles.find((role) => role.name === "Owner") ?? mockRoles[0];
  const categories: ChannelCategory[] = template.categories.map((category, categoryIndex) => {
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
    ownerId: summary.ownerId ?? undefined,
    name: summary.name,
    icon: getIcon(summary.name),
    accentColor: summary.accentColor || template.accentColor,
    description: summary.description,
    visibility: summary.visibility,
    publicReadEnabled: summary.publicReadEnabled,
    roles: mockRoles,
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
