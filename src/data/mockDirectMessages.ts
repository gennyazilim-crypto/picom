import { currentUserId } from "./mockCommunities";
import type { DirectConversation } from "../types/directMessages";

export const mockDirectConversations: DirectConversation[] = [
  {
    id: "dm-naines",
    participantUserId: "u-naines",
    participantName: "Nainesh Selarka",
    participantUsername: "nainesh",
    participantStatus: "online",
    participantStatusText: "Designing on Figma",
    lastMessagePreview: "Beta DM foundation is ready as a safe placeholder.",
    updatedAt: "2026-07-04T12:24:00.000Z",
    unreadCount: 2,
    messages: [
      {
        id: "dm-naines-1",
        conversationId: "dm-naines",
        authorId: "u-naines",
        body: "Can we keep direct messages compact and desktop-native?",
        createdAt: "2026-07-04T12:18:00.000Z",
      },
      {
        id: "dm-naines-2",
        conversationId: "dm-naines",
        authorId: currentUserId,
        body: "Yes. This beta keeps DM as a placeholder foundation until backend policy is ready.",
        createdAt: "2026-07-04T12:21:00.000Z",
      },
      {
        id: "dm-naines-3",
        conversationId: "dm-naines",
        authorId: "u-naines",
        body: "Perfect. No mobile layout, no production DM claims yet.",
        createdAt: "2026-07-04T12:24:00.000Z",
        isPlaceholder: true,
      },
    ],
  },
  {
    id: "dm-krishna",
    participantUserId: "u-krishna",
    participantName: "Krishna",
    participantUsername: "krishna",
    participantStatus: "idle",
    participantStatusText: "Coding on VS Code",
    lastMessagePreview: "Supabase RLS should own production DM access later.",
    updatedAt: "2026-07-04T11:55:00.000Z",
    unreadCount: 0,
    messages: [
      {
        id: "dm-krishna-1",
        conversationId: "dm-krishna",
        authorId: "u-krishna",
        body: "For production DM, we should treat RLS as the source of truth.",
        createdAt: "2026-07-04T11:48:00.000Z",
      },
      {
        id: "dm-krishna-2",
        conversationId: "dm-krishna",
        authorId: currentUserId,
        body: "Agreed. This screen is only the client foundation.",
        createdAt: "2026-07-04T11:55:00.000Z",
      },
    ],
  },
  {
    id: "dm-radha",
    participantUserId: "u-radha",
    participantName: "Radha",
    participantUsername: "radha",
    participantStatus: "offline",
    participantStatusText: "Offline",
    lastMessagePreview: "Message requests and privacy settings are future work.",
    updatedAt: "2026-07-03T19:40:00.000Z",
    unreadCount: 0,
    messages: [
      {
        id: "dm-radha-1",
        conversationId: "dm-radha",
        authorId: "u-radha",
        body: "Message requests and privacy settings can come after the beta shell is stable.",
        createdAt: "2026-07-03T19:40:00.000Z",
        isPlaceholder: true,
      },
    ],
  },
];
