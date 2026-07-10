import { currentUserId } from "./mockCommunities";
import type { DirectConversation, DirectMessageAttachment } from "../types/directMessages";

function createDmArtwork(label: string, first: string, second: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs><rect width="720" height="480" rx="42" fill="url(#g)"/><circle cx="570" cy="110" r="150" fill="white" opacity=".12"/><circle cx="160" cy="420" r="210" fill="white" opacity=".08"/><text x="48" y="420" fill="white" font-family="sans-serif" font-size="42" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const designReview: DirectMessageAttachment = { id: "dm-media-design-review", type: "image", url: createDmArtwork("Design review", "#315e61", "#77b7ad"), name: "design-review.png", mimeType: "image/png", width: 720, height: 480 };
const releaseBoard: DirectMessageAttachment = { id: "dm-media-release-board", type: "image", url: createDmArtwork("Release board", "#9f493d", "#e79a58"), name: "release-board.png", mimeType: "image/png", width: 720, height: 480 };
const workspaceNotes: DirectMessageAttachment = { id: "dm-media-workspace-notes", type: "image", url: createDmArtwork("Workspace notes", "#334c62", "#6d8fa8"), name: "workspace-notes.png", mimeType: "image/png", width: 720, height: 480 };

export const mockDirectConversations: DirectConversation[] = [
  {
    id: "dm-naines", participantUserId: "u-naines", participantName: "Nainesh Selarka", participantUsername: "nainesh",
    participantStatus: "online", participantStatusText: "Designing on Figma", lastMessagePreview: "The review board is ready.", updatedAt: "2026-07-04T12:24:00.000Z", unreadCount: 2,
    mutualCommunities: [{ id: "aurora", name: "Aurora Studio" }, { id: "makers", name: "Makers Hub" }], sharedMedia: [designReview, releaseBoard],
    messages: [
      { id: "dm-naines-1", conversationId: "dm-naines", authorId: "u-naines", body: "Can we keep direct messages compact and desktop-native?", createdAt: "2026-07-04T12:18:00.000Z", reactions: [{ emoji: "👍", count: 2, reactedByCurrentUser: true }] },
      { id: "dm-naines-2", conversationId: "dm-naines", authorId: currentUserId, body: "Yes. The conversation list, chat and details panel can stay visible together.", createdAt: "2026-07-04T12:21:00.000Z", replyPreview: { messageId: "dm-naines-1", authorName: "Nainesh", body: "Can we keep direct messages compact and desktop-native?" } },
      { id: "dm-naines-3", conversationId: "dm-naines", authorId: "u-naines", body: "The review board is ready.", createdAt: "2026-07-04T12:24:00.000Z", attachments: [designReview, releaseBoard], reactions: [{ emoji: "🔥", count: 4 }, { emoji: "👀", count: 3 }] },
    ],
  },
  {
    id: "dm-krishna", participantUserId: "u-krishna", participantName: "Krishna", participantUsername: "krishna", participantStatus: "idle", participantStatusText: "Coding on VS Code",
    lastMessagePreview: "Supabase RLS owns production DM access.", updatedAt: "2026-07-04T11:55:00.000Z", unreadCount: 0,
    mutualCommunities: [{ id: "aurora", name: "Aurora Studio" }], sharedMedia: [workspaceNotes],
    messages: [
      { id: "dm-krishna-1", conversationId: "dm-krishna", authorId: "u-krishna", body: "For production DM, RLS should remain the source of truth.", createdAt: "2026-07-04T11:48:00.000Z" },
      { id: "dm-krishna-2", conversationId: "dm-krishna", authorId: currentUserId, body: "Agreed. Components stay behind the service layer.", createdAt: "2026-07-04T11:55:00.000Z", attachments: [workspaceNotes] },
    ],
  },
  {
    id: "dm-radha", participantUserId: "u-radha", participantName: "Radha", participantUsername: "radha", participantStatus: "offline", participantStatusText: "Offline",
    lastMessagePreview: "Privacy controls are ready for service wiring.", updatedAt: "2026-07-03T19:40:00.000Z", unreadCount: 0, muted: true,
    mutualCommunities: [{ id: "music", name: "Sound Garden" }], sharedMedia: [],
    messages: [{ id: "dm-radha-1", conversationId: "dm-radha", authorId: "u-radha", body: "Privacy controls are ready for service wiring.", createdAt: "2026-07-03T19:40:00.000Z" }],
  },
];
