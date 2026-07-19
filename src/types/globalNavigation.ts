import type { IconName } from "../components/AppIcon";

export type GlobalNavigationKey = "feed" | "dm" | "communities" | "discover" | "radio" | "podcasts" | "events" | "bookmarks";
export type GlobalUtilityKey = "settings" | "helpSupport";
export type GlobalSidebarItemKey = GlobalNavigationKey | GlobalUtilityKey;
export type GlobalNavigationStatus = "available" | "unavailable";

export type GlobalNavigationBadgeState = Readonly<{
  dmUnread: number;
  communityUnread: number;
  radioLive: number;
  eventUpcoming: number;
  bookmarkCount: number;
}>;

export type GlobalNavigationAvailability = Readonly<{
  hasRadioWorkspace: boolean;
  hasPodcastWorkspace: boolean;
}>;

export type GlobalNavigationRegistryItem = Readonly<{
  key: GlobalSidebarItemKey;
  label: string;
  ariaLabel: string;
  icon: IconName;
  section: "primary" | "utility";
  status: (availability: GlobalNavigationAvailability) => GlobalNavigationStatus;
  unavailableReason?: string;
  badgeSelector: (state: GlobalNavigationBadgeState) => number | string | null;
}>;
