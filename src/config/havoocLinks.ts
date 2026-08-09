/**
 * Central HAVOOC Support Hub outbound links and campaign constants.
 * Owner identity must be a profile UUID (never email string matching).
 */

export const HAVOOC_PROJECT_ID = "havooc" as const;

export const HAVOOC_DEVELOPMENT_GOAL_EUR = 200_000;

export const HAVOOC_LINKS = Object.freeze({
  donate: "https://picom.gg/havooc/donate",
  support: "https://picom.gg/havooc/support",
  kickstarter: "https://www.kickstarter.com/projects/havooc",
  picomCommunity: "https://picom.gg",
  reddit: "https://www.reddit.com/r/HAVOOC",
  instagram: "https://www.instagram.com/havoocgame",
} as const);

/** Optional canonical owner profile UUID from public env (not email). */
export function getHavoocOwnerUserId(): string | null {
  const raw =
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_HAVOOC_OWNER_USER_ID) ||
    "";
  const trimmed = String(raw).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export const SUPPORT_NOTE_MAX_WORDS = 20;
export const SUPPORT_NOTE_MAX_CHARS = 160;
export const SUPPORT_NOTE_PAGE_SIZE = 24;
