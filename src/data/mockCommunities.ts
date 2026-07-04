import type { Community } from "../types/community";
import { createMockCategories } from "./mockChannels";
import { createMockMembers, mockRoles } from "./mockMembers";
import { createMockMessagesForCommunity } from "./mockMessages";
export { currentUserId } from "./mockMembers";

const makeCommunity = (id: string, name: string, icon: string, accentColor: string, offset: number): Community => {
  const members = createMockMembers(id, offset);
  const generalId = `${id}-general`;
  return {
    id,
    name,
    icon,
    accentColor,
    roles: mockRoles,
    members,
    categories: createMockCategories(id, generalId),
    messages: createMockMessagesForCommunity(id, generalId, members),
  };
};

export const mockCommunities: Community[] = [
  makeCommunity("aurora", "Aurora Studio", "A", "#007571", 0),
  makeCommunity("north", "North Dock", "N", "#10C2BB", 6),
  makeCommunity("terra", "Terra Lab", "T", "#C24D0F", 12),
  makeCommunity("pixel", "Pixel Guild", "P", "#FF772E", 18),
  makeCommunity("orbit", "Orbit Works", "O", "#752C05", 24),
];