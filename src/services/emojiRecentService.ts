export type RecentEmoji = Readonly<{
  emoji: string;
  label: string;
  usedAt: number;
}>;

const STORAGE_KEY = "picom.emoji-recents.v1";
const MAX_RECENT_EMOJIS = 24;

function isRecentEmoji(value: unknown): value is RecentEmoji {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecentEmoji>;
  return typeof candidate.emoji === "string"
    && candidate.emoji.length > 0
    && candidate.emoji.length <= 32
    && typeof candidate.label === "string"
    && candidate.label.length > 0
    && candidate.label.length <= 80
    && typeof candidate.usedAt === "number"
    && Number.isFinite(candidate.usedAt);
}

function read(): RecentEmoji[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEmoji).slice(0, MAX_RECENT_EMOJIS);
  } catch {
    return [];
  }
}

function write(items: RecentEmoji[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_EMOJIS)));
  } catch {
    // Storage can be unavailable in privacy or safe mode. Selection still works.
  }
}

export const emojiRecentService = {
  list(): RecentEmoji[] {
    return read();
  },

  record(emoji: string, label: string): RecentEmoji[] {
    const normalizedEmoji = emoji.trim().slice(0, 32);
    const normalizedLabel = label.trim().slice(0, 80);
    if (!normalizedEmoji || !normalizedLabel) return read();
    const next = [
      { emoji: normalizedEmoji, label: normalizedLabel, usedAt: Date.now() },
      ...read().filter((item) => item.emoji !== normalizedEmoji),
    ].slice(0, MAX_RECENT_EMOJIS);
    write(next);
    return next;
  },

  clear(): void {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Safe no-op when storage is unavailable.
    }
  },
};
