import type { Member, Role } from "../types/community";

export const currentUserId = "user-me";

export const mockRoles: Role[] = [
  { id: "owner", name: "Owner", color: "var(--picom-teal)", level: 100 },
  { id: "admin", name: "Admin", color: "var(--picom-aqua)", level: 80 },
  { id: "mod", name: "Moderator", color: "var(--picom-orange)", level: 60 },
  { id: "member", name: "Member", color: "var(--text-muted)", level: 10 },
  { id: "guest", name: "Guest", color: "var(--picom-brown)", level: 1 },
];

const mockMemberNames = [
  "Ada",
  "Mira",
  "Jonas",
  "Selin",
  "Kerem",
  "Noor",
  "Lina",
  "Atlas",
  "Eren",
  "Vera",
  "Mert",
  "Elif",
  "Kai",
  "Nora",
  "Deniz",
  "Sena",
  "Leo",
  "Aylin",
  "Rin",
  "Mina",
  "Emir",
  "Duru",
  "Aras",
  "Iris",
  "Kaan",
  "Lale",
  "Niko",
  "Yuna",
  "Bora",
  "Raya",
  "Tuna",
  "Alara",
  "Milo",
  "Sia",
  "Onur",
  "Eva",
];

export function createMockMembers(prefix: string, offset: number): Member[] {
  return mockMemberNames.slice(offset, offset + 12).map((name, index) => {
    const roleId = index === 0 ? "owner" : index === 1 ? "admin" : index === 2 ? "mod" : index > 9 ? "guest" : "member";
    const status = index % 7 === 0 ? "offline" : index % 5 === 0 ? "idle" : index % 6 === 0 ? "dnd" : "online";

    const isBot = index === 8;
    return {
      id: `${prefix}-member-${index}`,
      userId: index === 0 ? currentUserId : `${prefix}-user-${index}`,
      displayName: index === 0 ? "Picom Pilot" : isBot ? "Picom Helper" : name,
      username: index === 0 ? "picom.pilot" : isBot ? `helper.${prefix}` : `${name.toLowerCase()}.${prefix}`,
      avatarSeed: `${prefix}-${name}-${index}`,
      status,
      statusText: isBot ? "Community automation" : status === "offline" ? "Offline" : index % 3 === 0 ? "Designing channels" : "Available on desktop",
      roleId,
      bio: index === 0 ? "Building the first Picom desktop community." : isBot ? "A safe mock bot identity with no executable runtime." : "Community member placeholder profile.",
      isBot,
    };
  });
}
