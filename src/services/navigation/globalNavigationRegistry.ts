import type {
  GlobalNavigationAvailability,
  GlobalNavigationBadgeState,
  GlobalNavigationKey,
  GlobalNavigationRegistryItem,
} from "../../types/globalNavigation";
import { isV1GlobalNavigationEnabled } from "../../config/v1ReleaseScope";

const available = () => "available" as const;
const noBadge = () => null;

const allGlobalNavigationItems: readonly GlobalNavigationRegistryItem[] = [
  { key: "feed", label: "Feed", ariaLabel: "Open Feed", icon: "home", section: "primary", status: available, badgeSelector: noBadge },
  { key: "dm", label: "DM", ariaLabel: "Open direct messages", icon: "inbox", section: "primary", status: available, badgeSelector: (state) => state.dmUnread },
  { key: "communities", label: "Communities", ariaLabel: "Open communities", icon: "users", section: "primary", status: available, badgeSelector: (state) => state.communityUnread },
  { key: "discover", label: "Discover", ariaLabel: "Discover communities", icon: "search", section: "primary", status: available, badgeSelector: noBadge },
  { key: "radio", label: "Radio", ariaLabel: "Open Radio", icon: "volume", section: "primary", status: (availability) => availability.hasRadioWorkspace ? "available" : "unavailable", unavailableReason: "No accessible Radio community is available.", badgeSelector: (state) => state.radioLive ? "Live" : null },
  { key: "podcasts", label: "Podcasts", ariaLabel: "Open Podcasts", icon: "headphones", section: "primary", status: (availability) => availability.hasPodcastWorkspace ? "available" : "unavailable", unavailableReason: "No accessible Podcast community is available.", badgeSelector: noBadge },
  { key: "events", label: "Events", ariaLabel: "Open upcoming events", icon: "bell", section: "primary", status: available, badgeSelector: (state) => state.eventUpcoming },
  { key: "bookmarks", label: "Bookmarks", ariaLabel: "Open bookmarks", icon: "pin", section: "primary", status: available, badgeSelector: noBadge },
  { key: "settings", label: "Settings", ariaLabel: "Open user settings", icon: "settings", section: "utility", status: available, badgeSelector: noBadge },
  { key: "helpSupport", label: "Help & Support", ariaLabel: "Open Help and Support", icon: "user", section: "utility", status: available, badgeSelector: noBadge },
];

export const globalNavigationRegistry: readonly GlobalNavigationRegistryItem[] = allGlobalNavigationItems.filter((item) => isV1GlobalNavigationEnabled(item.key));

export const primaryGlobalNavigationItems = globalNavigationRegistry.filter((item) => item.section === "primary");
export const utilityGlobalNavigationItems = globalNavigationRegistry.filter((item) => item.section === "utility");

export function resolveGlobalNavigationKey(activeView: string): GlobalNavigationKey | null {
  const resolved = activeView === "mentionFeed" ? "feed"
    : activeView === "directMessages" ? "dm"
      : activeView === "community" ? "communities"
        : activeView === "discovery" ? "discover"
          : activeView === "radioCommunity" ? "radio"
            : activeView === "podcastCommunity" ? "podcasts"
              : activeView === "events" ? "events"
                : activeView === "savedMessages" ? "bookmarks"
                  : null;
  return resolved && isV1GlobalNavigationEnabled(resolved) ? resolved : null;
}

export const emptyGlobalNavigationBadges: GlobalNavigationBadgeState = {
  dmUnread: 0,
  communityUnread: 0,
  radioLive: 0,
  eventUpcoming: 0,
  bookmarkCount: 0,
};

export const defaultGlobalNavigationAvailability: GlobalNavigationAvailability = {
  hasRadioWorkspace: false,
  hasPodcastWorkspace: false,
};
