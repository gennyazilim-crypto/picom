import type {
  GlobalNavigationAvailability,
  GlobalNavigationBadgeState,
  GlobalNavigationKey,
  GlobalNavigationRegistryItem,
} from "../../types/globalNavigation";
import { isV1GlobalNavigationEnabled } from "../../config/v1ReleaseScope";
import type { TFunction } from "../../i18n";

const available = () => "available" as const;
const noBadge = () => null;

const allGlobalNavigationItems: readonly GlobalNavigationRegistryItem[] = [
  { key: "feed", label: "Feed", ariaLabel: "Open Feed", icon: "home", section: "primary", status: available, badgeSelector: noBadge },
  { key: "dm", label: "DM", ariaLabel: "Open direct messages", icon: "inbox", section: "primary", status: available, badgeSelector: (state) => state.dmUnread },
  { key: "communities", label: "Communities", ariaLabel: "Open communities", icon: "users", section: "primary", status: available, badgeSelector: (state) => state.communityUnread },
  {
    key: "live",
    label: "Live",
    ariaLabel: "Open live screen shares",
    icon: "live",
    section: "primary",
    status: available,
    tooltip: "Canlı ekran paylaşımları",
    badgeSelector: (state) => (state.liveActive > 99 ? "99+" : state.liveActive > 0 ? state.liveActive : null),
  },
  { key: "discover", label: "Discover", ariaLabel: "Discover communities", icon: "search", section: "primary", status: available, badgeSelector: noBadge },
  { key: "radio", label: "Radio", ariaLabel: "Open Radio", icon: "volume", section: "primary", status: (availability) => availability.hasRadioWorkspace ? "available" : "unavailable", unavailableReason: "No accessible Radio community is available.", badgeSelector: (state) => state.radioLive ? "Live" : null },
  { key: "podcasts", label: "Podcasts", ariaLabel: "Open Podcasts", icon: "headphones", section: "primary", status: (availability) => availability.hasPodcastWorkspace ? "available" : "unavailable", unavailableReason: "No accessible Podcast community is available.", badgeSelector: noBadge },
  { key: "events", label: "Events", ariaLabel: "Open upcoming events", icon: "calendar", section: "primary", status: available, badgeSelector: (state) => state.eventUpcoming },
  { key: "bookmarks", label: "Bookmarks", ariaLabel: "Open bookmarks", icon: "pin", section: "primary", status: available, badgeSelector: noBadge },
  { key: "settings", label: "Settings", ariaLabel: "Open user settings", icon: "settings", section: "utility", status: available, badgeSelector: noBadge },
  { key: "helpSupport", label: "Help & Support", ariaLabel: "Open Help and Support", icon: "user", section: "utility", status: available, badgeSelector: noBadge },
];

export function getGlobalNavigationItems(t: TFunction): readonly GlobalNavigationRegistryItem[] {
  return allGlobalNavigationItems
    .filter((item) => isV1GlobalNavigationEnabled(item.key))
    .map((item) => ({
      ...item,
      label: t(`nav.${item.key}.label`),
      ariaLabel: t(`nav.${item.key}.aria`),
      tooltip: item.tooltip ? t(`nav.${item.key}.tooltip`) : undefined,
      unavailableReason: item.unavailableReason ? t(`nav.${item.key}.unavailable`) : undefined,
    }));
}

export function getPrimaryGlobalNavigationItems(t: TFunction): readonly GlobalNavigationRegistryItem[] {
  return getGlobalNavigationItems(t).filter((item) => item.section === "primary");
}

export function getUtilityGlobalNavigationItems(t: TFunction): readonly GlobalNavigationRegistryItem[] {
  return getGlobalNavigationItems(t).filter((item) => item.section === "utility");
}

export function resolveGlobalNavigationKey(activeView: string): GlobalNavigationKey | null {
  const resolved = activeView === "mentionFeed" ? "feed"
    : activeView === "directMessages" ? "dm"
      : activeView === "community" ? "communities"
        : activeView === "live" ? "live"
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
  liveActive: 0,
  radioLive: 0,
  eventUpcoming: 0,
  bookmarkCount: 0,
};

export const defaultGlobalNavigationAvailability: GlobalNavigationAvailability = {
  hasRadioWorkspace: false,
  hasPodcastWorkspace: false,
};
