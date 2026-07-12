import type { GlobalSidebarItemKey } from "../types/globalNavigation";
import type { CommunityKind } from "../types/community";
import type { DeepLinkAction } from "../services/deepLinkService";

export type V1ScopeClassification = "IN_V1" | "CONDITIONAL" | "HIDDEN_FROM_V1" | "POST_V1" | "BLOCKER";

export type V1FeatureKey =
  | "desktopShell"
  | "firstLaunch"
  | "supabaseAuth"
  | "feed"
  | "textCommunities"
  | "textMessaging"
  | "attachments"
  | "replies"
  | "reactions"
  | "readState"
  | "profile"
  | "friends"
  | "directMessages"
  | "userSettings"
  | "communityAdmin"
  | "helpSupport"
  | "safeDiagnostics"
  | "globalSearch"
  | "voiceRooms"
  | "screenShare"
  | "radio"
  | "podcasts"
  | "events"
  | "bookmarks"
  | "meetingWorkspace"
  | "enhancedNoiseShield"
  | "discoveryMarketplace"
  | "platformAdminOperations"
  | "customCommunityEmoji"
  | "customCommunityStickers"
  | "bots"
  | "webhooks"
  | "plugins"
  | "enterprise"
  | "ssoScim"
  | "billing"
  | "aiFeatures"
  | "recording"
  | "captions"
  | "aiSummaries"
  | "linuxStable"
  | "macosStable";

export type V1ReleaseFeature = Readonly<{
  classification: V1ScopeClassification;
  enabled: boolean;
  reason: string;
}>;

const inV1 = (reason: string): V1ReleaseFeature => Object.freeze({ classification: "IN_V1", enabled: true, reason });
const hidden = (reason: string): V1ReleaseFeature => Object.freeze({ classification: "HIDDEN_FROM_V1", enabled: false, reason });
const postV1 = (reason: string): V1ReleaseFeature => Object.freeze({ classification: "POST_V1", enabled: false, reason });

export const v1ReleaseScope = Object.freeze({
  releaseId: "picom-v1-core",
  version: "1.0.0",
  channel: "stable",
  productName: "Picom",
  supportedPlatforms: Object.freeze(["windows"] as const),
  features: Object.freeze<Record<V1FeatureKey, V1ReleaseFeature>>({
    desktopShell: inV1("Secure Electron desktop shell and custom titlebar."),
    firstLaunch: inV1("Windows first-launch and onboarding flow."),
    supabaseAuth: inV1("Production authentication and session restore."),
    feed: inV1("Text and community activity feed without post-V1 media products."),
    textCommunities: inV1("Text communities, channels, roles, membership, and moderation."),
    textMessaging: inV1("Realtime text messaging with production data only."),
    attachments: inV1("Validated message image attachments."),
    replies: inV1("Message and direct-message replies."),
    reactions: inV1("Emoji reactions."),
    readState: inV1("Unread, mention, and read-state foundations."),
    profile: inV1("Profile identity, avatar, cover, privacy, and verification display."),
    friends: inV1("Friend requests and relationship state."),
    directMessages: inV1("Participant-only direct conversations."),
    userSettings: inV1("User-owned account, profile, privacy, appearance, notification, legal, and diagnostic settings."),
    communityAdmin: inV1("Core community settings, channels, roles, members, invites, moderation, audit, and safety controls."),
    helpSupport: inV1("Offline core help and safe support entry points."),
    safeDiagnostics: inV1("Redacted diagnostics and local recovery controls."),
    globalSearch: inV1("Search limited to V1-visible entities."),
    voiceRooms: hidden("Task 621 found no hosted two-client or packaged-Windows device evidence; Voice Rooms are excluded from V1."),
    screenShare: hidden("Task 621 found no packaged-Windows picker, remote-render, stop, and cleanup evidence; Screen Share is excluded from V1."),
    radio: hidden("Radio data and code are retained but excluded from Picom V1 Core."),
    podcasts: hidden("Podcast data and code are retained but excluded from Picom V1 Core."),
    events: hidden("The event workspace is not a V1 Core surface."),
    bookmarks: hidden("The standalone bookmarks workspace is not a V1 Core surface."),
    meetingWorkspace: hidden("Meeting workspace, stage, and camera surfaces are not in V1 Core."),
    enhancedNoiseShield: hidden("Enhanced noise-shield controls are not release-certified for V1 Core."),
    discoveryMarketplace: hidden("Public discovery marketplace is excluded from V1 Core."),
    platformAdminOperations: hidden("Internal platform operations are not a public V1 user surface."),
    customCommunityEmoji: postV1("Custom community emoji administration remains after V1 Core."),
    customCommunityStickers: postV1("Custom community sticker administration remains after V1 Core."),
    bots: postV1("Bots are explicitly post-V1."),
    webhooks: postV1("Webhooks are explicitly post-V1."),
    plugins: postV1("Plugin runtime is explicitly post-V1."),
    enterprise: postV1("Enterprise administration is explicitly post-V1."),
    ssoScim: postV1("SSO and SCIM are explicitly post-V1."),
    billing: postV1("Billing is explicitly post-V1."),
    aiFeatures: postV1("AI features are explicitly post-V1."),
    recording: postV1("Recording is not in V1 Core."),
    captions: postV1("Captions are not in V1 Core."),
    aiSummaries: postV1("AI summaries are not in V1 Core."),
    linuxStable: postV1("Linux remains an engineering target, not a Picom V1 stable platform claim."),
    macosStable: postV1("macOS remains an engineering target, not a Picom V1 stable platform claim."),
  }),
});

export function isV1FeatureEnabled(feature: V1FeatureKey): boolean {
  return v1ReleaseScope.features[feature].enabled;
}

export function getV1FeatureClassification(feature: V1FeatureKey): V1ScopeClassification {
  return v1ReleaseScope.features[feature].classification;
}

const globalNavigationFeature: Readonly<Record<GlobalSidebarItemKey, V1FeatureKey>> = Object.freeze({
  feed: "feed",
  dm: "directMessages",
  communities: "textCommunities",
  radio: "radio",
  podcasts: "podcasts",
  events: "events",
  bookmarks: "bookmarks",
  settings: "userSettings",
  helpSupport: "helpSupport",
});

export function isV1GlobalNavigationEnabled(key: GlobalSidebarItemKey): boolean {
  return isV1FeatureEnabled(globalNavigationFeature[key]);
}

export function isV1CommunityKindEnabled(kind: CommunityKind): boolean {
  return kind === "text" && isV1FeatureEnabled("textCommunities");
}

export function isV1ChannelTypeEnabled(type: string): boolean {
  if (type === "voice") return isV1FeatureEnabled("voiceRooms");
  return type === "text" || type === "forum" || type === "announcement";
}

export function isV1ActiveViewEnabled(activeView: string): boolean {
  if (["mentionFeed", "profile"].includes(activeView)) return isV1FeatureEnabled(activeView === "profile" ? "profile" : "feed");
  if (activeView === "directMessages") return isV1FeatureEnabled("directMessages");
  if (activeView === "friends") return isV1FeatureEnabled("friends");
  if (activeView === "community") return isV1FeatureEnabled("textCommunities");
  if (activeView === "support") return isV1FeatureEnabled("helpSupport");
  if (activeView === "radioCommunity") return isV1FeatureEnabled("radio");
  if (activeView === "podcastCommunity") return isV1FeatureEnabled("podcasts");
  if (activeView === "events") return isV1FeatureEnabled("events");
  if (activeView === "savedMessages") return isV1FeatureEnabled("bookmarks");
  if (activeView === "discovery") return isV1FeatureEnabled("discoveryMarketplace");
  return false;
}

export function isV1DeepLinkTypeEnabled(type: DeepLinkAction["type"]): boolean {
  if (["passwordRecovery", "emailVerification", "invite", "friends"].includes(type)) return true;
  if (type === "community") return isV1FeatureEnabled("textCommunities");
  if (type === "radio") return isV1FeatureEnabled("radio");
  if (type === "podcast") return isV1FeatureEnabled("podcasts");
  if (type === "meeting" || type === "meetingChat") return isV1FeatureEnabled("meetingWorkspace");
  return false;
}

export function isV1SearchCategoryEnabled(category: string): boolean {
  if (category === "Radio") return isV1FeatureEnabled("radio");
  if (category === "Podcasts") return isV1FeatureEnabled("podcasts");
  if (category === "Events") return isV1FeatureEnabled("events");
  if (category === "Saved") return isV1FeatureEnabled("bookmarks");
  return true;
}

export function isV1MentionQuickFilterEnabled(filter: string | null): boolean {
  if (filter === "radio") return isV1FeatureEnabled("radio");
  if (filter === "podcast") return isV1FeatureEnabled("podcasts");
  return true;
}

export function isV1CommunityAdminSectionEnabled(section: string): boolean {
  const featureBySection: Readonly<Record<string, V1FeatureKey>> = Object.freeze({
    bots: "bots",
    webhooks: "webhooks",
    events: "events",
    emojis: "customCommunityEmoji",
    stickers: "customCommunityStickers",
    insights: "platformAdminOperations",
  });
  const feature = featureBySection[section];
  return feature ? isV1FeatureEnabled(feature) : true;
}
