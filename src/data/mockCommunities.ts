import type { Community, Member, Message, Role } from "../types/community";
export const currentUserId = "user-me";
const roles: Role[] = [
  { id: "owner", name: "Owner", color: "var(--picom-teal)", level: 100 },
  { id: "admin", name: "Admin", color: "var(--picom-aqua)", level: 80 },
  { id: "mod", name: "Moderator", color: "var(--picom-orange)", level: 60 },
  { id: "member", name: "Member", color: "var(--text-muted)", level: 10 },
  { id: "guest", name: "Guest", color: "var(--picom-brown)", level: 1 }
];
const names = ["Ada","Mira","Jonas","Selin","Kerem","Noor","Lina","Atlas","Eren","Vera","Mert","Elif","Kai","Nora","Deniz","Sena","Leo","Aylin","Rin","Mina","Emir","Duru","Aras","Iris","Kaan","Lale","Niko","Yuna","Bora","Raya","Tuna","Alara","Milo","Sia","Onur","Eva"];
const svgImage = (label: string, a: string, b: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="960" height="640" rx="52" fill="url(#g)"/><circle cx="770" cy="140" r="124" fill="rgba(255,255,255,.22)"/><path d="M76 520 C220 344 356 446 504 296 C640 158 748 296 886 208 L886 564 L76 564 Z" fill="rgba(255,255,255,.30)"/><text x="74" y="104" font-family="Arial" font-size="44" font-weight="700" fill="rgba(255,255,255,.92)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
const makeMembers = (prefix: string, offset: number): Member[] => names.slice(offset, offset + 12).map((name, index) => {
  const roleId = index === 0 ? "owner" : index === 1 ? "admin" : index === 2 ? "mod" : index > 9 ? "guest" : "member";
  const status = index % 7 === 0 ? "offline" : index % 5 === 0 ? "idle" : index % 6 === 0 ? "dnd" : "online";
  return { id: `${prefix}-member-${index}`, userId: index === 0 ? currentUserId : `${prefix}-user-${index}`, displayName: index === 0 ? "Picom Pilot" : name, username: index === 0 ? "picom.pilot" : `${name.toLowerCase()}.${prefix}`, avatarSeed: `${prefix}-${name}-${index}`, status, statusText: status === "offline" ? "Offline" : index % 3 === 0 ? "Designing channels" : "Available on desktop", roleId, bio: index === 0 ? "Building the first Picom desktop community." : "Community member placeholder profile." };
});
const messageSet = (channelId: string, members: Member[], prefix: string): Message[] => [
  "Welcome to Picom. The desktop shell should feel calm, precise, and fast.",
  "The four-column structure is the anchor: rail, channels, chat, members.",
  "Sharing generated image references for the attachment grid.",
  "The composer should stay pinned even when the channel gets busy.",
  "Light mode needs soft surfaces and clear hierarchy.",
  "Dark mode should be charcoal, separated, and never pure black.",
  "Channel density feels close to the reference without copying it.",
  "Local mock messages are enough until the backend integration phase."
].map((body, index) => ({
  id: `${prefix}-msg-${index}`, channelId, authorId: members[(index + 1) % members.length].userId, body, createdAt: new Date(Date.now() - (8 - index) * 1000 * 60 * 16).toISOString(),
  attachments: index === 2 ? [{ id: `${prefix}-att-1`, type: "image", url: svgImage("Picom 01", "#007571", "#10C2BB"), alt: "Teal desktop gradient" }] : index === 4 ? [{ id: `${prefix}-att-2a`, type: "image", url: svgImage("Frame A", "#10C2BB", "#007571"), alt: "Aqua frame" }, { id: `${prefix}-att-2b`, type: "image", url: svgImage("Frame B", "#FF772E", "#C24D0F"), alt: "Orange frame" }] : index === 6 ? [{ id: `${prefix}-att-3a`, type: "image", url: svgImage("Mood A", "#C24D0F", "#752C05"), alt: "Burnt orange mood" }, { id: `${prefix}-att-3b`, type: "image", url: svgImage("Mood B", "#007571", "#10C2BB"), alt: "Teal mood" }, { id: `${prefix}-att-3c`, type: "image", url: svgImage("Mood C", "#FF772E", "#752C05"), alt: "Autumn mood" }] : index === 7 ? [{ id: `${prefix}-att-4a`, type: "image", url: svgImage("Shot 1", "#007571", "#10C2BB"), alt: "Shot one" }, { id: `${prefix}-att-4b`, type: "image", url: svgImage("Shot 2", "#FF772E", "#C24D0F"), alt: "Shot two" }, { id: `${prefix}-att-4c`, type: "image", url: svgImage("Shot 3", "#C24D0F", "#752C05"), alt: "Shot three" }, { id: `${prefix}-att-4d`, type: "image", url: svgImage("Shot 4", "#10C2BB", "#007571"), alt: "Shot four" }] : undefined,
  reactions: index % 3 === 0 ? [{ emoji: "Fire", count: index + 2 }, { emoji: "Eyes", count: 3 }] : undefined
}));
const makeCommunity = (id: string, name: string, icon: string, accentColor: string, offset: number): Community => {
  const members = makeMembers(id, offset); const generalId = `${id}-general`;
  return { id, name, icon, accentColor, roles, members, categories: [
    { id: `${id}-info`, name: "Information", channels: [{ id: `${id}-welcome`, name: "welcome", type: "text", topic: "Start here", unread: true }, { id: `${id}-announcements`, name: "announcements", type: "text", topic: "Important updates", mentions: id === "aurora" ? 2 : 0 }] },
    { id: `${id}-channels`, name: "Channels", channels: [{ id: generalId, name: "general-text", type: "text", topic: "Everyday community chat" }, { id: `${id}-showcase`, name: "showcase", type: "text", topic: "Share polished work" }, { id: `${id}-private`, name: "team-room", type: "text", topic: "Private channel placeholder", isPrivate: true }] },
    { id: `${id}-music`, name: "Music & Bots", collapsedByDefault: id === "terra", channels: [{ id: `${id}-listening`, name: "music-voice-channel", type: "voice", topic: "Voice placeholder" }, { id: `${id}-studio`, name: "bot-commands", type: "text", topic: "Music and creative flow" }] },
    { id: `${id}-general-cat`, name: "General", channels: [{ id: `${id}-talk`, name: "general-talk", type: "text", topic: "General talk" }, { id: `${id}-events`, name: "events", type: "text", topic: "Community events placeholder" }] },
    { id: `${id}-workspace`, name: "Work Space", channels: [{ id: `${id}-planning`, name: "planning", type: "text", topic: "Desktop MVP planning" }, { id: `${id}-focus`, name: "focus-room", type: "voice", topic: "Voice channel placeholder" }] }
  ], messages: [...messageSet(generalId, members, id), ...messageSet(`${id}-welcome`, members, `${id}-welcome`).slice(0, 2), ...messageSet(`${id}-showcase`, members, `${id}-showcase`).slice(0, 3), ...messageSet(`${id}-talk`, members, `${id}-talk`).slice(0, 2)] };
};
export const mockCommunities: Community[] = [makeCommunity("aurora", "Aurora Studio", "A", "#007571", 0), makeCommunity("north", "North Dock", "N", "#10C2BB", 6), makeCommunity("terra", "Terra Lab", "T", "#C24D0F", 12), makeCommunity("pixel", "Pixel Guild", "P", "#FF772E", 18), makeCommunity("orbit", "Orbit Works", "O", "#752C05", 24)];
