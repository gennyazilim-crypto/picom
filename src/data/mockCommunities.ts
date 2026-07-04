import type { Community, Member, Message } from "../types/community";
import { createMockCategories } from "./mockChannels";
import { createMockMembers, mockRoles } from "./mockMembers";
export { currentUserId } from "./mockMembers";

const svgImage = (label: string, a: string, b: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="960" height="640" rx="52" fill="url(#g)"/><circle cx="770" cy="140" r="124" fill="rgba(255,255,255,.22)"/><path d="M76 520 C220 344 356 446 504 296 C640 158 748 296 886 208 L886 564 L76 564 Z" fill="rgba(255,255,255,.30)"/><text x="74" y="104" font-family="Arial" font-size="44" font-weight="700" fill="rgba(255,255,255,.92)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const messageSet = (channelId: string, members: Member[], prefix: string): Message[] => [
  "Welcome to Picom. The desktop shell should feel calm, precise, and fast.",
  "The four-column structure is the anchor: rail, channels, chat, members.",
  "Sharing generated image references for the attachment grid.",
  "The composer should stay pinned even when the channel gets busy.",
  "Light mode needs soft surfaces and clear hierarchy.",
  "Dark mode should be charcoal, separated, and never pure black.",
  "Channel density feels close to the reference without copying it.",
  "Local mock messages are enough until the backend integration phase.",
].map((body, index) => ({
  id: `${prefix}-msg-${index}`,
  channelId,
  authorId: members[(index + 1) % members.length].userId,
  body,
  createdAt: new Date(Date.now() - (8 - index) * 1000 * 60 * 16).toISOString(),
  attachments:
    index === 2
      ? [{ id: `${prefix}-att-1`, type: "image", url: svgImage("Picom 01", "#007571", "#10C2BB"), alt: "Teal desktop gradient" }]
      : index === 4
        ? [
            { id: `${prefix}-att-2a`, type: "image", url: svgImage("Frame A", "#10C2BB", "#007571"), alt: "Aqua frame" },
            { id: `${prefix}-att-2b`, type: "image", url: svgImage("Frame B", "#FF772E", "#C24D0F"), alt: "Orange frame" },
          ]
        : index === 6
          ? [
              { id: `${prefix}-att-3a`, type: "image", url: svgImage("Mood A", "#C24D0F", "#752C05"), alt: "Burnt orange mood" },
              { id: `${prefix}-att-3b`, type: "image", url: svgImage("Mood B", "#007571", "#10C2BB"), alt: "Teal mood" },
              { id: `${prefix}-att-3c`, type: "image", url: svgImage("Mood C", "#FF772E", "#752C05"), alt: "Autumn mood" },
            ]
          : index === 7
            ? [
                { id: `${prefix}-att-4a`, type: "image", url: svgImage("Shot 1", "#007571", "#10C2BB"), alt: "Shot one" },
                { id: `${prefix}-att-4b`, type: "image", url: svgImage("Shot 2", "#FF772E", "#C24D0F"), alt: "Shot two" },
                { id: `${prefix}-att-4c`, type: "image", url: svgImage("Shot 3", "#C24D0F", "#752C05"), alt: "Shot three" },
                { id: `${prefix}-att-4d`, type: "image", url: svgImage("Shot 4", "#10C2BB", "#007571"), alt: "Shot four" },
              ]
            : undefined,
  reactions: index % 3 === 0 ? [{ emoji: "Fire", count: index + 2 }, { emoji: "Eyes", count: 3 }] : undefined,
}));

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
    messages: [
      ...messageSet(generalId, members, id),
      ...messageSet(`${id}-welcome`, members, `${id}-welcome`).slice(0, 2),
      ...messageSet(`${id}-showcase`, members, `${id}-showcase`).slice(0, 3),
      ...messageSet(`${id}-talk`, members, `${id}-talk`).slice(0, 2),
    ],
  };
};

export const mockCommunities: Community[] = [
  makeCommunity("aurora", "Aurora Studio", "A", "#007571", 0),
  makeCommunity("north", "North Dock", "N", "#10C2BB", 6),
  makeCommunity("terra", "Terra Lab", "T", "#C24D0F", 12),
  makeCommunity("pixel", "Pixel Guild", "P", "#FF772E", 18),
  makeCommunity("orbit", "Orbit Works", "O", "#752C05", 24),
];