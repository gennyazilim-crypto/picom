import type { MentionFeedTab, MentionQuickFilter } from "../../types/mentions";
import type { FollowedUserStory } from "../../types/stories";

const STORAGE_KEY = "picom.feed-ui-state.v1";
const tabs = new Set<MentionFeedTab>(["feed", "following"]);
const filters = new Set<MentionQuickFilter>(["today", "week", "unread", "saved", "text", "radio", "podcast"]);
type FeedUiState = Readonly<{ tab: MentionFeedTab; filter: MentionQuickFilter | null; seenStoryIds: readonly string[] }>;
const fallback: FeedUiState = { tab: "feed", filter: null, seenStoryIds: [] };

function read(): FeedUiState {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const tab = typeof parsed.tab === "string" && tabs.has(parsed.tab as MentionFeedTab) ? parsed.tab as MentionFeedTab : "feed";
    const filter = typeof parsed.filter === "string" && filters.has(parsed.filter as MentionQuickFilter) ? parsed.filter as MentionQuickFilter : null;
    const seenStoryIds = Array.isArray(parsed.seenStoryIds) ? parsed.seenStoryIds.filter((id): id is string => typeof id === "string").slice(-500) : [];
    return { tab, filter, seenStoryIds };
  } catch { return fallback; }
}

function write(state: FeedUiState) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Best effort only. */ }
}

export const feedUiStateService = {
  getSelection() { const state = read(); return { tab: state.tab, filter: state.filter }; },
  setSelection(tab: MentionFeedTab, filter: MentionQuickFilter | null) { write({ ...read(), tab, filter }); },
  markStorySeen(storyId: string) { const state = read(); write({ ...state, seenStoryIds: [...new Set([...state.seenStoryIds, storyId])].slice(-500) }); },
  isStorySeen(storyId: string) { return read().seenStoryIds.includes(storyId); },
  resetLayoutState() { write(fallback); },
  applySeenState(stories: readonly FollowedUserStory[]): FollowedUserStory[] {
    const seen = new Set(read().seenStoryIds);
    return stories.map((story) => seen.has(story.id) ? { ...story, status: "seen" } : story);
  },
};
