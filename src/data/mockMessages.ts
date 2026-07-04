import type { Member, Message } from "../types/community";
import { createMockAttachmentsForMessage } from "./mockAttachments";

const messageBodies = [
  "Welcome to Picom. The desktop shell should feel calm, precise, and fast.",
  "The four-column structure is the anchor: rail, channels, chat, members.",
  "Sharing generated image references for the attachment grid.",
  "The composer should stay pinned even when the channel gets busy.",
  "Light mode needs soft surfaces and clear hierarchy.",
  "Dark mode should be charcoal, separated, and never pure black.",
  "Channel density feels close to the reference without copying it.",
  "Local mock messages are enough until the backend integration phase.",
];

const MOCK_BASE_TIME = Date.UTC(2026, 6, 4, 12, 0, 0);

export function createMockMessageSet(channelId: string, members: Member[], prefix: string): Message[] {
  return messageBodies.map((body, index) => ({
    id: `${prefix}-msg-${index}`,
    channelId,
    authorId: members[(index + 1) % members.length].userId,
    body,
    createdAt: new Date(MOCK_BASE_TIME - (8 - index) * 1000 * 60 * 16).toISOString(),
    attachments: createMockAttachmentsForMessage(prefix, index),
    reactions: index % 3 === 0 ? [{ emoji: "Fire", count: index + 2 }, { emoji: "Eyes", count: 3 }] : undefined,
  }));
}

export function createMockMessagesForCommunity(id: string, generalId: string, members: Member[]): Message[] {
  return [
    ...createMockMessageSet(generalId, members, id),
    ...createMockMessageSet(`${id}-welcome`, members, `${id}-welcome`).slice(0, 2),
    ...createMockMessageSet(`${id}-showcase`, members, `${id}-showcase`).slice(0, 3),
    ...createMockMessageSet(`${id}-talk`, members, `${id}-talk`).slice(0, 2),
  ];
}
