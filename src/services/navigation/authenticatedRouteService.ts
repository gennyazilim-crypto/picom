export type AuthenticatedRouteKey =
  | "feed"
  | "directMessages"
  | "communities"
  | "radio"
  | "podcasts"
  | "events"
  | "bookmarks"
  | "settings"
  | "support"
  | "profile"
  | "meeting"
  | "voice";

export type AuthenticatedEntryReason =
  | "login"
  | "registration"
  | "onboarding_complete"
  | "session_restore"
  | "relaunch";

export type AuthenticatedRouteIntent = {
  route: AuthenticatedRouteKey;
  source: AuthenticatedEntryReason | "deep_link";
  params?: Readonly<Record<string, string>>;
};

export type AuthenticatedLandingIntent = {
  route: "feed";
  source: AuthenticatedEntryReason;
};

export type LegacyAuthenticatedView =
  | "mentionFeed"
  | "directMessages"
  | "community"
  | "radio"
  | "podcasts"
  | "events"
  | "savedMessages"
  | "profile";

export const AUTHENTICATED_DEFAULT_VIEW = "feed" as const;

const ROUTE_ALIASES: Readonly<Record<string, AuthenticatedRouteKey>> = {
  home: "feed",
  mentionfeed: "feed",
  dm: "directMessages",
  directmessages: "directMessages",
  community: "communities",
  communities: "communities",
  savedmessages: "bookmarks",
  bookmarks: "bookmarks",
};

const AUTHENTICATED_ROUTES = new Set<AuthenticatedRouteKey>([
  "feed",
  "directMessages",
  "communities",
  "radio",
  "podcasts",
  "events",
  "bookmarks",
  "settings",
  "support",
  "profile",
  "meeting",
  "voice",
]);

const REQUIRED_DEEP_LINK_PARAM: Partial<Record<AuthenticatedRouteKey, string>> = {
  profile: "userId",
  meeting: "meetingId",
  voice: "channelId",
};

export function normalizeAuthenticatedRouteKey(
  value: string | null | undefined,
): AuthenticatedRouteKey | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (AUTHENTICATED_ROUTES.has(normalized as AuthenticatedRouteKey)) {
    return normalized as AuthenticatedRouteKey;
  }
  return ROUTE_ALIASES[normalized.toLowerCase()] ?? null;
}

export function createAuthenticatedLandingIntent(
  reason: AuthenticatedEntryReason,
): AuthenticatedLandingIntent {
  return { route: AUTHENTICATED_DEFAULT_VIEW, source: reason };
}

export function toLegacyActiveView(route: "feed"): "mentionFeed";
export function toLegacyActiveView(route: AuthenticatedRouteKey): LegacyAuthenticatedView;
export function toLegacyActiveView(route: AuthenticatedRouteKey): LegacyAuthenticatedView {
  switch (route) {
    case "directMessages":
      return "directMessages";
    case "communities":
    case "meeting":
    case "voice":
      return "community";
    case "radio":
      return "radio";
    case "podcasts":
      return "podcasts";
    case "events":
      return "events";
    case "bookmarks":
      return "savedMessages";
    case "profile":
      return "profile";
    case "feed":
    case "settings":
    case "support":
    default:
      return "mentionFeed";
  }
}

export function resolveAuthenticatedDeepLink(
  routeValue: string | null | undefined,
  params: Readonly<Record<string, string | null | undefined>> = {},
  isAuthenticated = false,
): AuthenticatedRouteIntent | null {
  if (!isAuthenticated) return null;
  const route = normalizeAuthenticatedRouteKey(routeValue);
  if (!route) return null;

  const requiredParam = REQUIRED_DEEP_LINK_PARAM[route];
  if (requiredParam && !params[requiredParam]?.trim()) return null;

  const safeParams = Object.fromEntries(
    Object.entries(params)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0),
  );

  return {
    route,
    source: "deep_link",
    ...(Object.keys(safeParams).length > 0 ? { params: safeParams } : {}),
  };
}

export function createAuthenticatedEntryRouter() {
  let currentUserId: string | null = null;

  return {
    onSessionChanged(
      userId: string | null | undefined,
      reason: AuthenticatedEntryReason = "session_restore",
    ): AuthenticatedLandingIntent | null {
      if (!userId) {
        currentUserId = null;
        return null;
      }
      if (currentUserId === userId) return null;
      currentUserId = userId;
      return createAuthenticatedLandingIntent(reason);
    },
    reset(): void {
      currentUserId = null;
    },
  };
}

export const authenticatedEntryRouter = createAuthenticatedEntryRouter();
