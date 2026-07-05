export type ImageCacheKind =
  | "avatar"
  | "community_icon"
  | "attachment_thumbnail"
  | "attachment_full"
  | "custom_emoji"
  | "sticker_placeholder";

export type ImageCachePrivacy = "public" | "authenticated" | "private";

export type ImageCacheEntry = Readonly<{
  key: string;
  url: string;
  kind: ImageCacheKind;
  privacy: ImageCachePrivacy;
  version?: string;
  cachedAt: string;
  lastUsedAt: string;
}>;

export type RegisterImageCacheInput = Readonly<{
  key: string;
  url: string;
  kind: ImageCacheKind;
  privacy?: ImageCachePrivacy;
  version?: string;
}>;

const MAX_MEMORY_ENTRIES = 120;
const memoryCache = new Map<string, ImageCacheEntry>();

function normalizeKey(input: string): string {
  return input.trim().toLowerCase();
}

function canCache(input: RegisterImageCacheInput): boolean {
  if (!input.key.trim() || !input.url.trim()) return false;

  const privacy = input.privacy ?? "authenticated";
  if (privacy === "private" && (input.kind === "attachment_full" || input.kind === "attachment_thumbnail")) {
    return false;
  }

  return true;
}

function trimCache() {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return;

  const sorted = Array.from(memoryCache.entries()).sort(([, left], [, right]) => left.lastUsedAt.localeCompare(right.lastUsedAt));
  const removable = sorted.slice(0, Math.max(0, memoryCache.size - MAX_MEMORY_ENTRIES));
  removable.forEach(([key]) => memoryCache.delete(key));
}

export const imageCacheService = {
  canCache,

  register(input: RegisterImageCacheInput): ImageCacheEntry | null {
    if (!canCache(input)) return null;

    const now = new Date().toISOString();
    const key = normalizeKey(input.key);
    const existing = memoryCache.get(key);
    const entry: ImageCacheEntry = {
      key,
      url: input.url,
      kind: input.kind,
      privacy: input.privacy ?? "authenticated",
      version: input.version,
      cachedAt: existing?.cachedAt ?? now,
      lastUsedAt: now,
    };

    memoryCache.set(key, entry);
    trimCache();
    return entry;
  },

  resolve(key: string): string | null {
    const normalized = normalizeKey(key);
    const entry = memoryCache.get(normalized);
    if (!entry) return null;

    const updated: ImageCacheEntry = { ...entry, lastUsedAt: new Date().toISOString() };
    memoryCache.set(normalized, updated);
    return updated.url;
  },

  invalidate(key: string) {
    memoryCache.delete(normalizeKey(key));
  },

  invalidateByPrefix(prefix: string) {
    const normalizedPrefix = normalizeKey(prefix);
    Array.from(memoryCache.keys())
      .filter((key) => key.startsWith(normalizedPrefix))
      .forEach((key) => memoryCache.delete(key));
  },

  clearMemoryCache() {
    memoryCache.clear();
  },

  getSummary() {
    const entries = Array.from(memoryCache.values());
    return {
      entries: entries.length,
      maxEntries: MAX_MEMORY_ENTRIES,
      byKind: entries.reduce<Record<ImageCacheKind, number>>((summary, entry) => {
        summary[entry.kind] = (summary[entry.kind] ?? 0) + 1;
        return summary;
      }, {
        avatar: 0,
        community_icon: 0,
        attachment_thumbnail: 0,
        attachment_full: 0,
        custom_emoji: 0,
        sticker_placeholder: 0,
      }),
    };
  },
};
