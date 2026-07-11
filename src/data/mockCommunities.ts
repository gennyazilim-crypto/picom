import type { Community, Member } from "../types/community";
import type { CommunityKind } from "../types/community";
import type { Role } from "../types/community";
import { createMockCategories } from "./mockChannels";
import { createMockMembers, currentUserId, mockRoles } from "./mockMembers";
import { createMockMessagesForCommunity } from "./mockMessages";
import { selectMockFixture } from "../config/dataSourcePolicy";
export { currentUserId } from "./mockMembers";

type CurrentUserCommunityRole = "owner" | "admin" | "mod" | "member" | "visitor";

type MockCommunityConfig = {
  id: string;
  kind: CommunityKind;
  name: string;
  icon: string;
  accentColor: string;
  offset: number;
  currentUserRole: CurrentUserCommunityRole;
  visibility: "public" | "private";
  publicReadEnabled: boolean;
  description: string;
};

const mockRadioRoles: Role[] = [
  { id: "owner", name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "viewRadioContent", "listenRadio", "hostRadio", "manageRadioCommunity", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "publishRadioAnnouncements", "moderateRadioComments"] },
  { id: "radio-producer", name: "Radio Producer", color: "var(--picom-orange)", level: 70, capabilities: ["viewRadioContent", "listenRadio", "hostRadio", "manageRadioSchedule", "manageRadioPrograms", "manageRadioHosts", "moderateRadioComments"] },
  { id: "radio-host", name: "Radio Host", color: "var(--picom-aqua)", level: 50, capabilities: ["viewRadioContent", "listenRadio", "hostRadio"] },
  { id: "member", name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["viewRadioContent", "listenRadio"] },
];

const mockPodcastRoles: Role[] = [
  { id: "owner", name: "Owner", color: "var(--picom-teal)", level: 100, capabilities: ["manageCommunity", "viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments", "managePodcastCommunity"] },
  { id: "podcast-publisher", name: "Podcast Publisher", color: "var(--picom-aqua)", level: 50, capabilities: ["viewPodcastContent", "listenPodcasts", "createPodcastDrafts", "publishPodcasts", "editPodcastMetadata", "archivePodcastEpisodes", "managePodcastSeries", "commentOnPodcasts", "reactToPodcasts"] },
  { id: "podcast-editor", name: "Podcast Editor", color: "var(--picom-orange)", level: 40, capabilities: ["viewPodcastContent", "listenPodcasts", "editPodcastMetadata", "commentOnPodcasts", "reactToPodcasts", "moderatePodcastComments"] },
  { id: "member", name: "Member", color: "var(--text-muted)", level: 10, capabilities: ["viewPodcastContent", "listenPodcasts", "commentOnPodcasts", "reactToPodcasts"] },
];

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

const makeCommunity = ({ id, kind, name, icon, accentColor, offset, currentUserRole, visibility, publicReadEnabled, description }: MockCommunityConfig): Community => {
  const baseMembers = createMockMembers(id, offset);
  const roleSet = kind === "radio" ? mockRadioRoles : kind === "podcast" ? mockPodcastRoles : mockRoles;
  const { members: accessMembers, ownerId } = applyCurrentUserRole(id, baseMembers, currentUserRole);
  const validRoleIds = new Set(roleSet.map((role) => role.id));
  const members = accessMembers.map((member) => validRoleIds.has(member.roleId) ? member : { ...member, roleId: "member" });
  const generalId = `${id}-general`;
  const categories = (kind === "text" ? createMockCategories(id, generalId) : []).map((category) => ({
    ...category,
    channels: category.channels.map((channel) => ({
      ...channel,
      publicReadEnabled: !channel.isPrivate,
    })),
  }));

  return {
    id,
    kind,
    ownerId,
    name,
    icon,
    accentColor,
    description,
    visibility,
    publicReadEnabled,
    rulesEnabled: true,
    rulesVersion: "1",
    roles: roleSet,
    members,
    categories,
    messages: kind === "text" ? createMockMessagesForCommunity(id, generalId, members) : [],
  };
};

const rawMockCommunities: Community[] = [
  makeCommunity({ id: "aurora", kind: "text", name: "Aurora Studio", icon: "A", accentColor: "#007571", offset: 0, currentUserRole: "owner", visibility: "public", publicReadEnabled: true, description: "Owner scenario for Picom workspace operations." }),
  makeCommunity({ id: "north", kind: "text", name: "North Dock", icon: "N", accentColor: "#10C2BB", offset: 6, currentUserRole: "admin", visibility: "public", publicReadEnabled: true, description: "Admin scenario with broad management access." }),
  makeCommunity({ id: "terra", kind: "text", name: "Terra Lab", icon: "T", accentColor: "#C24D0F", offset: 12, currentUserRole: "mod", visibility: "public", publicReadEnabled: true, description: "Moderator scenario for report and message moderation tools." }),
  makeCommunity({ id: "pixel", kind: "text", name: "Pixel Guild", icon: "P", accentColor: "#FF772E", offset: 18, currentUserRole: "member", visibility: "public", publicReadEnabled: true, description: "Member scenario with community info and leave controls." }),
  makeCommunity({ id: "orbit", kind: "text", name: "Orbit Works", icon: "O", accentColor: "#752C05", offset: 24, currentUserRole: "visitor", visibility: "public", publicReadEnabled: true, description: "Visitor scenario: public read is available, participation requires joining." }),
  makeCommunity({ id: "picom-radio", kind: "radio", name: "Picom Radio", icon: "R", accentColor: "#007571", offset: 30, currentUserRole: "owner", visibility: "public", publicReadEnabled: true, description: "Type-safe mock station for Radio sessions and schedules." }),
  makeCommunity({ id: "picom-podcast", kind: "podcast", name: "Picom Podcasts", icon: "P", accentColor: "#C24D0F", offset: 36, currentUserRole: "owner", visibility: "public", publicReadEnabled: true, description: "Type-safe mock library for Podcast publishing and listener discussion." }),
];

export const mockCommunities = selectMockFixture<Community[]>(rawMockCommunities, []);

export const mockCommunityKindExamples = Object.freeze({
  text: Object.freeze({ id: "kind-example-text", kind: "text", name: "Text community example" }),
  radio: Object.freeze({ id: "kind-example-radio", kind: "radio", name: "Radio community example" }),
  podcast: Object.freeze({ id: "kind-example-podcast", kind: "podcast", name: "Podcast community example" }),
}) satisfies Readonly<Record<CommunityKind, Readonly<Pick<Community, "id" | "kind" | "name">>>>;
