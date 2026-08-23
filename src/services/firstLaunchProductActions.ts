import { isV1FeatureEnabled } from "../config/v1ReleaseScope.ts";
import {
  FIRST_LAUNCH_PURPOSE_IDS,
  sanitizeFirstLaunchPurposeIds,
  type FirstLaunchPurposeId,
} from "./firstLaunchPersonalization.ts";

/**
 * FIRST PRODUCT ACTION MODE:
 * POST_AUTH_ONLY
 *
 * Actions are shown only when the user is already eligible for main PICOM UI.
 * They never auto-execute from purpose selection and never persist account destinations.
 */
export const FIRST_PRODUCT_ACTION_MODE = "POST_AUTH_ONLY" as const;

export const FIRST_PRODUCT_ACTION_IDS = [
  "feed",
  "messages",
  "communities",
  "create-community",
  "add-friend",
] as const;

export type FirstProductActionId = (typeof FIRST_PRODUCT_ACTION_IDS)[number];

export type FirstProductActionCapability = Readonly<{
  authenticated: boolean;
  legalAccepted: boolean;
  onboardingComplete: boolean;
  feed: boolean;
  messages: boolean;
  communities: boolean;
  discovery: boolean;
  createCommunity: boolean;
  addFriend: boolean;
}>;

export type FirstProductAction = Readonly<{
  id: FirstProductActionId;
  labelKey: `ready.action.${FirstProductActionId}`;
  route: "mentionFeed" | "directMessages" | "community" | "discovery" | "friends";
  opensCreateCommunity: boolean;
  friendsTab: "suggestions" | null;
  authRequired: true;
}>;

export type FirstProductActionInput = Readonly<{
  purposeIds?: unknown;
  capabilities?: Partial<FirstProductActionCapability>;
}>;

const PURPOSE_ACTION_ORDER: Readonly<Record<FirstLaunchPurposeId, readonly FirstProductActionId[]>> = {
  friends: ["add-friend", "messages", "feed", "communities", "create-community"],
  communities: ["communities", "create-community", "feed", "messages", "add-friend"],
  gaming: ["communities", "messages", "feed", "add-friend", "create-community"],
  work: ["messages", "communities", "feed", "add-friend", "create-community"],
  creator: ["communities", "create-community", "feed", "messages", "add-friend"],
};

const NEUTRAL_ACTION_ORDER: readonly FirstProductActionId[] = [
  "feed",
  "messages",
  "communities",
  "create-community",
  "add-friend",
];

export function sanitizeFirstProductActionId(value: unknown): FirstProductActionId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if ((FIRST_PRODUCT_ACTION_IDS as readonly string[]).includes(normalized)) {
    return normalized as FirstProductActionId;
  }
  return null;
}

export function defaultFirstProductActionCapabilities(
  partial: Partial<FirstProductActionCapability> = {},
): FirstProductActionCapability {
  const authenticated = partial.authenticated === true;
  const legalAccepted = partial.legalAccepted === true;
  const onboardingComplete = partial.onboardingComplete === true;
  const eligible = authenticated && legalAccepted && onboardingComplete;
  return {
    authenticated,
    legalAccepted,
    onboardingComplete,
    feed: partial.feed ?? isV1FeatureEnabled("feed"),
    messages: partial.messages ?? isV1FeatureEnabled("directMessages"),
    communities: partial.communities ?? isV1FeatureEnabled("textCommunities"),
    discovery: partial.discovery ?? isV1FeatureEnabled("discoveryMarketplace"),
    createCommunity: partial.createCommunity ?? (eligible && isV1FeatureEnabled("textCommunities")),
    addFriend: partial.addFriend ?? (eligible && isV1FeatureEnabled("friends")),
  };
}

function isActionAvailable(id: FirstProductActionId, capabilities: FirstProductActionCapability): boolean {
  if (!capabilities.authenticated || !capabilities.legalAccepted || !capabilities.onboardingComplete) return false;
  if (id === "feed") return capabilities.feed;
  if (id === "messages") return capabilities.messages;
  if (id === "communities") return capabilities.communities || capabilities.discovery;
  if (id === "create-community") return capabilities.createCommunity;
  return capabilities.addFriend;
}

function toAction(id: FirstProductActionId, capabilities: FirstProductActionCapability): FirstProductAction {
  return {
    id,
    labelKey: `ready.action.${id}`,
    route: id === "feed"
      ? "mentionFeed"
      : id === "messages"
        ? "directMessages"
        : id === "add-friend"
          ? "friends"
          : id === "communities" && capabilities.discovery
            ? "discovery"
            : "community",
    opensCreateCommunity: id === "create-community",
    friendsTab: id === "add-friend" ? "suggestions" : null,
    authRequired: true,
  };
}

function rankActionIds(purposeIds: readonly FirstLaunchPurposeId[]): readonly FirstProductActionId[] {
  if (!purposeIds.length) return NEUTRAL_ACTION_ORDER;
  const score = new Map<FirstProductActionId, number>();
  for (const purposeId of FIRST_LAUNCH_PURPOSE_IDS) {
    if (!purposeIds.includes(purposeId)) continue;
    PURPOSE_ACTION_ORDER[purposeId].forEach((actionId, index) => {
      const current = score.get(actionId);
      if (current === undefined || index < current) score.set(actionId, index);
    });
  }
  return [...NEUTRAL_ACTION_ORDER].sort((left, right) => {
    const leftScore = score.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightScore = score.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftScore - rightScore || NEUTRAL_ACTION_ORDER.indexOf(left) - NEUTRAL_ACTION_ORDER.indexOf(right);
  });
}

export type FirstProductActionDestination = Readonly<{
  view: FirstProductAction["route"];
  conversationId: null;
  communityId: null;
  userId: null;
  friendsTab: "suggestions" | null;
  openCreateCommunity: boolean;
}>;

/** Maps a displayed action to a real high-level destination. Never carries private IDs. */
export function toFirstProductActionDestination(action: FirstProductAction): FirstProductActionDestination {
  return {
    view: action.route,
    conversationId: null,
    communityId: null,
    userId: null,
    friendsTab: action.friendsTab,
    openCreateCommunity: action.opensCreateCommunity,
  };
}

/** Pure ranking. Never auto-executes an action. */
export function resolveFirstProductActions(input: FirstProductActionInput = {}): readonly FirstProductAction[] {
  const capabilities = defaultFirstProductActionCapabilities(input.capabilities);
  const purposeIds = sanitizeFirstLaunchPurposeIds(input.purposeIds);
  return rankActionIds(purposeIds)
    .filter((id) => isActionAvailable(id, capabilities))
    .map((id) => toAction(id, capabilities));
}
