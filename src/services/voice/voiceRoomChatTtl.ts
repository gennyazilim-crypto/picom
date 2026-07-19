import type { Message } from "../../types/community";

/** Voice room chat messages expire one-by-one this long after `createdAt`. */
export const VOICE_ROOM_CHAT_TTL_MS = 30 * 60 * 1000;

export function getVoiceChatMessageExpiryAt(createdAt: string): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return created + VOICE_ROOM_CHAT_TTL_MS;
}

export function isVoiceChatMessageAlive(message: Pick<Message, "createdAt" | "deletedAt">, now = Date.now()): boolean {
  if (message.deletedAt) return false;
  return now < getVoiceChatMessageExpiryAt(message.createdAt);
}

export function filterAliveVoiceChatMessages(messages: readonly Message[], now = Date.now()): Message[] {
  return messages
    .filter((message) => isVoiceChatMessageAlive(message, now))
    .sort((left, right) => {
      const leftOrder = left.localOrder ?? Date.parse(left.createdAt);
      const rightOrder = right.localOrder ?? Date.parse(right.createdAt);
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    });
}

/** Milliseconds until the next message should disappear, or null if nothing is pending. */
export function getNextVoiceChatExpiryDelayMs(messages: readonly Message[], now = Date.now()): number | null {
  let soonest: number | null = null;
  for (const message of messages) {
    if (message.deletedAt) continue;
    const expiresAt = getVoiceChatMessageExpiryAt(message.createdAt);
    if (expiresAt <= now) continue;
    if (soonest === null || expiresAt < soonest) soonest = expiresAt;
  }
  return soonest === null ? null : Math.max(0, soonest - now);
}

export function listExpiredVoiceChatMessages(messages: readonly Message[], now = Date.now()): Message[] {
  return messages.filter((message) => !message.deletedAt && !isVoiceChatMessageAlive(message, now));
}
