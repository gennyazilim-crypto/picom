/**
 * Maps React Router paths ↔ App ActiveView keys for the web client.
 * Desktop keeps internal ActiveView state; web syncs URL via WebNavigationContext.
 */

export type WebActiveView =
  | "mentionFeed"
  | "directMessages"
  | "community"
  | "profile"
  | "friends"
  | "events"
  | "savedMessages"
  | "discovery"
  | "support"
  | "rootPanel"
  | "radioCommunity"
  | "podcastCommunity";

export type WebPathParams = Readonly<{
  conversationId?: string;
  communitySlug?: string;
  channelId?: string;
  username?: string;
  roomId?: string;
  /** Settings is a modal over the shell; path sets openSettings intent. */
  openSettings?: boolean;
  /** Search is an overlay; path maps to mentionFeed with openSearch intent. */
  openSearch?: boolean;
  /** Notifications panel maps to mentionFeed with openNotifications intent. */
  openNotifications?: boolean;
  /** Voice room deep link. */
  voice?: boolean;
}>;

export type ParsedWebPath = Readonly<{
  activeView: WebActiveView;
  params: WebPathParams;
  authRoute?: "login" | "register" | "forgot-password" | "reset-password" | "auth-callback";
  isAuthRoute: boolean;
}>;

export type WebRouteDefinition = Readonly<{
  path: string;
  activeView: WebActiveView | null;
  note?: string;
}>;

/** Canonical route list for docs, smoke tests, and sitemap hints. */
export const WEB_ROUTES: readonly WebRouteDefinition[] = [
  { path: "/feed", activeView: "mentionFeed" },
  { path: "/messages", activeView: "directMessages" },
  { path: "/messages/:conversationId", activeView: "directMessages" },
  { path: "/communities", activeView: "community" },
  { path: "/communities/:communitySlug", activeView: "community" },
  { path: "/communities/:communitySlug/channels/:channelId", activeView: "community" },
  {
    path: "/notifications",
    activeView: "mentionFeed",
    note: "Notifications panel — maps to mentionFeed with openNotifications intent",
  },
  {
    path: "/search",
    activeView: "mentionFeed",
    note: "Search is an overlay — maps to mentionFeed with openSearch intent",
  },
  { path: "/profile/:username", activeView: "profile" },
  {
    path: "/settings",
    activeView: "mentionFeed",
    note: "Settings modal intent — maps to mentionFeed with openSettings flag",
  },
  {
    path: "/settings/*",
    activeView: "mentionFeed",
    note: "Settings section deep links open the settings modal",
  },
  { path: "/login", activeView: null },
  { path: "/register", activeView: null },
  { path: "/forgot-password", activeView: null },
  { path: "/reset-password", activeView: null },
  { path: "/auth/callback", activeView: null },
  { path: "/auth/handoff", activeView: null },
  {
    path: "/voice/:roomId",
    activeView: "community",
    note: "Voice room — community view with voice intent",
  },
  { path: "/friends", activeView: "friends" },
  { path: "/events", activeView: "events" },
  { path: "/bookmarks", activeView: "savedMessages" },
  { path: "/saved", activeView: "savedMessages" },
  { path: "/*", activeView: "mentionFeed", note: "Default feed fallback" },
] as const;

function encodeSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

/**
 * Build a web path from the current App ActiveView + optional params.
 */
export function pathFromActiveView(
  activeView: WebActiveView | string,
  params: WebPathParams = {},
): string {
  if (params.openSettings) {
    return "/settings";
  }
  if (params.openSearch) {
    return "/search";
  }
  if (params.openNotifications) {
    return "/notifications";
  }
  if (params.voice && params.roomId) {
    return `/voice/${encodeSegment(params.roomId)}`;
  }

  switch (activeView) {
    case "directMessages":
      return params.conversationId
        ? `/messages/${encodeSegment(params.conversationId)}`
        : "/messages";
    case "community":
    case "radioCommunity":
    case "podcastCommunity":
      if (params.communitySlug && params.channelId) {
        return `/communities/${encodeSegment(params.communitySlug)}/channels/${encodeSegment(params.channelId)}`;
      }
      if (params.communitySlug) {
        return `/communities/${encodeSegment(params.communitySlug)}`;
      }
      return "/communities";
    case "profile":
      return params.username ? `/profile/${encodeSegment(params.username)}` : "/feed";
    case "friends":
      return "/friends";
    case "events":
      return "/events";
    case "savedMessages":
      return "/bookmarks";
    case "mentionFeed":
    case "discovery":
    case "support":
    case "rootPanel":
    default:
      return "/feed";
  }
}

/**
 * Parse a browser pathname into ActiveView + params.
 */
export function parseWebPath(pathname: string): ParsedWebPath {
  const raw = pathname.split("?")[0] ?? "/";
  const path = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw || "/";
  const segments = path.split("/").filter(Boolean);

  if (segments[0] === "login") {
    return { activeView: "mentionFeed", params: {}, authRoute: "login", isAuthRoute: true };
  }
  if (segments[0] === "register") {
    return { activeView: "mentionFeed", params: {}, authRoute: "register", isAuthRoute: true };
  }
  if (segments[0] === "forgot-password") {
    return { activeView: "mentionFeed", params: {}, authRoute: "forgot-password", isAuthRoute: true };
  }
  if (segments[0] === "reset-password") {
    return { activeView: "mentionFeed", params: {}, authRoute: "reset-password", isAuthRoute: true };
  }
  if (segments[0] === "auth" && segments[1] === "callback") {
    return { activeView: "mentionFeed", params: {}, authRoute: "auth-callback", isAuthRoute: true };
  }

  if (segments[0] === "messages") {
    return {
      activeView: "directMessages",
      params: segments[1] ? { conversationId: decodeURIComponent(segments[1]) } : {},
      isAuthRoute: false,
    };
  }

  if (segments[0] === "communities") {
    const communitySlug = segments[1] ? decodeURIComponent(segments[1]) : undefined;
    const channelId =
      segments[2] === "channels" && segments[3] ? decodeURIComponent(segments[3]) : undefined;
    return {
      activeView: "community",
      params: {
        ...(communitySlug ? { communitySlug } : {}),
        ...(channelId ? { channelId } : {}),
      },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "notifications") {
    return {
      activeView: "mentionFeed",
      params: { openNotifications: true },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "search") {
    return {
      activeView: "mentionFeed",
      params: { openSearch: true },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "profile" && segments[1]) {
    return {
      activeView: "profile",
      params: { username: decodeURIComponent(segments[1]) },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "settings") {
    return {
      activeView: "mentionFeed",
      params: { openSettings: true },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "voice" && segments[1]) {
    return {
      activeView: "community",
      params: { roomId: decodeURIComponent(segments[1]), voice: true },
      isAuthRoute: false,
    };
  }

  if (segments[0] === "friends") {
    return { activeView: "friends", params: {}, isAuthRoute: false };
  }

  if (segments[0] === "events") {
    return { activeView: "events", params: {}, isAuthRoute: false };
  }

  if (segments[0] === "bookmarks" || segments[0] === "saved") {
    return { activeView: "savedMessages", params: {}, isAuthRoute: false };
  }

  // /feed and /* default
  return { activeView: "mentionFeed", params: {}, isAuthRoute: false };
}
