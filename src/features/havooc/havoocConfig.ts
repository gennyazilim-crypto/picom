/**
 * Canonical HAVOOC Support Hub links and project identity.
 * Donate/support CTAs must use this config — do not hardcode campaign URLs in UI.
 */
export const HAVOOC_PROJECT_KEY = "havooc" as const;

export const HAVOOC_DEVELOPMENT_GOAL_EUR = 200_000;

export const HAVOOC_LINKS = {
  donate: "https://www.havooc.com/donate",
  support: "https://www.havooc.com/support",
  kickstarter: "https://www.kickstarter.com/projects/havooc",
  website: "https://www.havooc.com",
  community: {
    picom: "https://picom.gg",
    reddit: "https://www.reddit.com/r/HAVOOC",
    instagram: "https://www.instagram.com/havooc",
  },
} as const;

export const SUPPORT_NOTE_MAX_WORDS = 20;
export const SUPPORT_NOTE_MAX_CHARS = 160;
export const SUPPORT_NOTES_PAGE_SIZE = 24;
