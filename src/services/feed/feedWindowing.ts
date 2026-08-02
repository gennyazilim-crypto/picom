/**
 * Controlled page windowing for long Feed lists (Approach B).
 * Keeps a bounded number of entries mounted while preserving stable keys
 * and allowing deep-link targets to force-include a message id.
 */

export type FeedWindowSlice<T extends { id: string }> = Readonly<{
  items: readonly T[];
  startIndex: number;
  endIndex: number;
  trimmedLeading: number;
  trimmedTrailing: number;
  total: number;
}>;

export function sliceFeedWindow<T extends { id: string }>(
  items: readonly T[],
  options: Readonly<{
    maxMounted?: number;
    keepTail?: boolean;
    ensureId?: string | null;
  }> = {},
): FeedWindowSlice<T> {
  const maxMounted = Math.max(20, options.maxMounted ?? 120);
  const total = items.length;
  if (total <= maxMounted) {
    return { items, startIndex: 0, endIndex: total, trimmedLeading: 0, trimmedTrailing: 0, total };
  }

  let startIndex = options.keepTail === false ? 0 : Math.max(0, total - maxMounted);
  let endIndex = startIndex + maxMounted;

  if (options.ensureId) {
    const ensureIndex = items.findIndex((item) => item.id === options.ensureId);
    if (ensureIndex >= 0 && (ensureIndex < startIndex || ensureIndex >= endIndex)) {
      startIndex = Math.max(0, ensureIndex - Math.floor(maxMounted / 3));
      endIndex = Math.min(total, startIndex + maxMounted);
      startIndex = Math.max(0, endIndex - maxMounted);
    }
  }

  return {
    items: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    trimmedLeading: startIndex,
    trimmedTrailing: Math.max(0, total - endIndex),
    total,
  };
}
