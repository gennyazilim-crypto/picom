import { currentUserId } from "../data/mockCommunities";
import { mockRoles } from "../data/mockMembers";
import type { CommunitySummary } from "../services/communityService";
import type { Community } from "../types/community";

function getIcon(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

export function createCommunityFromSummary(summary: CommunitySummary): Community {
  const channelId = `${summary.id}-general`;
  const categoryId = `${summary.id}-general-category`;
  const ownerRole = mockRoles.find((role) => role.name === "Owner") ?? mockRoles[0];

  return {
    id: summary.id,
    name: summary.name,
    icon: getIcon(summary.name),
    accentColor: summary.accentColor,
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
    categories: [
      {
        id: categoryId,
        name: "General",
        position: 0,
        channels: [
          {
            id: channelId,
            categoryId,
            name: "general",
            type: "text",
            topic: summary.description ?? "New Picom community",
            position: 0,
          },
        ],
      },
    ],
    messages: [],
  };
}