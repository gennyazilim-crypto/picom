import type { MentionItem } from "../../types/mentions";

const MAX_ITEMS = 200;
const STALE_AFTER_MS = 2 * 60 * 1000;

let ownerId: string | null = null;
let items: MentionItem[] = [];
let updatedAt = 0;
let duplicatesPrevented = 0;

function clone(item: MentionItem): MentionItem {
  return {
    ...item,
    attachments: item.attachments ? [...item.attachments] : undefined,
    reactions: item.reactions ? item.reactions.map((reaction) => ({ ...reaction })) : undefined,
    commenterIds: item.commenterIds ? [...item.commenterIds] : undefined,
    commentPreview: item.commentPreview ? item.commentPreview.map((comment) => ({ ...comment })) : undefined,
  };
}

function bounded(next: readonly MentionItem[]) {
  const deduplicated = new Map<string, MentionItem>();
  for (const item of next) {
    if (deduplicated.has(item.messageId)) duplicatesPrevented += 1;
    deduplicated.set(item.messageId, clone(item));
  }
  return [...deduplicated.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.messageId.localeCompare(left.messageId))
    .slice(0, MAX_ITEMS);
}

export const feedMentionCacheService = {
  reset(nextOwnerId: string) {
    if (ownerId === nextOwnerId) return;
    ownerId = nextOwnerId;
    items = [];
    updatedAt = 0;
    duplicatesPrevented = 0;
  },
  replace(next: readonly MentionItem[], localState: readonly MentionItem[] = []) {
    const localByMessageId = new Map(localState.map((item) => [item.messageId, item]));
    items = bounded(next.map((item) => {
      const local = localByMessageId.get(item.messageId);
      return local && !local.isUnread ? { ...item, isUnread: false } : item;
    }));
    updatedAt = Date.now();
    return items.map(clone);
  },
  removeSource(sourceId: string, localState: readonly MentionItem[] = items) {
    items = bounded(localState.filter((item) => item.messageId !== sourceId && item.id !== sourceId));
    updatedAt = Date.now();
    return items.map(clone);
  },
  snapshot() { return items.map(clone); },
  diagnostics() {
    return {
      size: items.length,
      maxItems: MAX_ITEMS,
      updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
      stale: !updatedAt || Date.now() - updatedAt > STALE_AFTER_MS,
      duplicatesPrevented,
    } as const;
  },
};
