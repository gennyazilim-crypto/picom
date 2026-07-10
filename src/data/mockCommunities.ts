import type { Community, Member } from "../types/community";
import { createMockCategories } from "./mockChannels";
import { createMockMembers, currentUserId, mockRoles } from "./mockMembers";
import { createMockMessagesForCommunity } from "./mockMessages";
export { currentUserId } from "./mockMembers";

type CurrentUserCommunityRole = "owner" | "admin" | "mod" | "member" | "visitor";

type MockCommunityConfig = {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  offset: number;
  currentUserRole: CurrentUserCommunityRole;
  visibility: "public" | "private";
  publicReadEnabled: boolean;
  description: string;
};

function applyCurrentUserRole(prefix: string, members: Member[], role: CurrentUserCommunityRole): { members: Member[]; ownerId: string } {
  if (role === "owner") {
    return { members, ownerId: currentUserId };
  }

  const nextMembers = members.map((member, index) => {
    if (index === 0 && role !== "visitor") {
      return { ...member, roleId: role };
    }

    if (index === 1) {
      return { ...member, roleId: "owner", statusText: "Community owner" };
    }

    return member;
  });

  if (role === "visitor") {
    const visitorMembers = nextMembers
      .filter((member) => member.userId !== currentUserId)
      .map((member, index) => (index === 0 ? { ...member, roleId: "owner", statusText: "Community owner" } : member));
    return { members: visitorMembers, ownerId: visitorMembers[0]?.userId ?? `${prefix}-owner` };
  }

  return { members: nextMembers, ownerId: nextMembers[1]?.userId ?? currentUserId };
}

const makeCommunity = ({ id, name, icon, accentColor, offset, currentUserRole, visibility, publicReadEnabled, description }: MockCommunityConfig): Community => {
  const baseMembers = createMockMembers(id, offset);
  const { members, ownerId } = applyCurrentUserRole(id, baseMembers, currentUserRole);
  const generalId = `${id}-general`;
  const categories = createMockCategories(id, generalId).map((category) => ({
    ...category,
    channels: category.channels.map((channel) => ({
      ...channel,
      publicReadEnabled: !channel.isPrivate,
    })),
  }));

  return {
    id,
    ownerId,
    name,
    icon,
    accentColor,
    description,
    visibility,
    publicReadEnabled,
    rulesEnabled: true,
    rulesVersion: "1",
    roles: mockRoles,
    members,
    categories,
    messages: createMockMessagesForCommunity(id, generalId, members),
  };
};

export const mockCommunities: Community[] = [
  makeCommunity({ id: "aurora", name: "Aurora Studio", icon: "A", accentColor: "#007571", offset: 0, currentUserRole: "owner", visibility: "public", publicReadEnabled: true, description: "Owner scenario for Picom workspace operations." }),
  makeCommunity({ id: "north", name: "North Dock", icon: "N", accentColor: "#10C2BB", offset: 6, currentUserRole: "admin", visibility: "public", publicReadEnabled: true, description: "Admin scenario with broad management access." }),
  makeCommunity({ id: "terra", name: "Terra Lab", icon: "T", accentColor: "#C24D0F", offset: 12, currentUserRole: "mod", visibility: "public", publicReadEnabled: true, description: "Moderator scenario for report and message moderation tools." }),
  makeCommunity({ id: "pixel", name: "Pixel Guild", icon: "P", accentColor: "#FF772E", offset: 18, currentUserRole: "member", visibility: "public", publicReadEnabled: true, description: "Member scenario with community info and leave controls." }),
  makeCommunity({ id: "orbit", name: "Orbit Works", icon: "O", accentColor: "#752C05", offset: 24, currentUserRole: "visitor", visibility: "public", publicReadEnabled: true, description: "Visitor scenario: public read is available, participation requires joining." }),
];
