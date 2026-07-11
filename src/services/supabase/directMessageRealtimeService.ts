import type { Database } from "./database.types";
import type { DirectMessage } from "../../types/directMessages";

type DirectMessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
export type DirectReactionRow = Database["public"]["Tables"]["direct_message_reactions"]["Row"];

export type DirectMessageRealtimeEvent =
  | Readonly<{ type: "direct_message:insert" | "direct_message:update"; message: DirectMessage }>
  | Readonly<{ type: "direct_message:delete"; conversationId: string; messageId: string }>
  | Readonly<{ type: "direct_reaction:add" | "direct_reaction:remove"; reaction: DirectReactionRow }>;

type Listener = (event: DirectMessageRealtimeEvent) => void;
const mockListeners = new Set<Listener>();

export function mapDirectMessageRow(row: DirectMessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorId: row.author_id,
    body: row.body ?? "",
    clientMessageId: row.client_message_id ?? undefined,
    replyToMessageId: row.reply_to_message_id ?? undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export const directMessageRealtimeService = {
  subscribeMock(listener: Listener): () => void {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
  publishMock(event: DirectMessageRealtimeEvent): void {
    for (const listener of mockListeners) listener(event);
  },
};
