import type { ChannelCategory, CommunityId } from "../types/community";

export function createMockCategories(id: CommunityId, generalId = `${id}-general`): ChannelCategory[] {
  return [
    {
      id: `${id}-info`,
      name: "Information",
      position: 1,
      channels: [
        { id: `${id}-welcome`, categoryId: `${id}-info`, name: "welcome", type: "text", topic: "Start here", unread: true, position: 1 },
        { id: `${id}-announcements`, categoryId: `${id}-info`, name: "announcements", type: "announcement", topic: "Important updates", mentions: id === "aurora" ? 2 : 0, position: 2 },
      ],
    },
    {
      id: `${id}-channels`,
      name: "Channels",
      position: 2,
      channels: [
        { id: generalId, categoryId: `${id}-channels`, name: "general-text", type: "text", topic: "Everyday community chat", position: 1 },
        { id: `${id}-showcase`, categoryId: `${id}-channels`, name: "showcase", type: "forum", topic: "Share polished work", position: 2 },
        { id: `${id}-private`, categoryId: `${id}-channels`, name: "team-room", type: "text", topic: "Private channel placeholder", isPrivate: true, position: 3 },
      ],
    },
    {
      id: `${id}-music`,
      name: "Music & Bots",
      collapsedByDefault: id === "terra",
      position: 3,
      channels: [
        { id: `${id}-listening`, categoryId: `${id}-music`, name: "music-voice-channel", type: "voice", topic: "Voice placeholder", position: 1 },
        { id: `${id}-studio`, categoryId: `${id}-music`, name: "bot-commands", type: "text", topic: "Music and creative flow", position: 2 },
      ],
    },
    {
      id: `${id}-general-cat`,
      name: "General",
      position: 4,
      channels: [
        { id: `${id}-talk`, categoryId: `${id}-general-cat`, name: "general-talk", type: "text", topic: "General talk", position: 1 },
        { id: `${id}-events`, categoryId: `${id}-general-cat`, name: "events", type: "text", topic: "Community events placeholder", position: 2 },
      ],
    },
    {
      id: `${id}-workspace`,
      name: "Work Space",
      position: 5,
      channels: [
        { id: `${id}-planning`, categoryId: `${id}-workspace`, name: "planning", type: "text", topic: "Desktop MVP planning", position: 1 },
        { id: `${id}-focus`, categoryId: `${id}-workspace`, name: "focus-room", type: "voice", topic: "Voice channel placeholder", position: 2 },
      ],
    },
  ];
}
