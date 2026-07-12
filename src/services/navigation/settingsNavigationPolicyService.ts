import type { SettingsSection } from "../settingsService";
import type { CommunityAccess } from "../../types/communityAccess";

export const USER_SETTINGS_SECTIONS = [
  "Account",
  "Profile",
  "Privacy & Safety",
  "Appearance",
  "Accessibility",
  "Notifications",
  "Voice & Audio",
  "Keyboard",
  "Advanced",
  "Diagnostics",
] as const;

export const COMMUNITY_SETTINGS_SECTIONS = [
  "Overview & Branding",
  "Roles",
  "Members",
  "Channels & Sections",
  "Invites",
  "Moderation",
  "Audit",
  "Danger Zone",
  "Text Settings",
  "Radio Settings",
  "Podcast Settings",
] as const;

export type UserSettingsSection = (typeof USER_SETTINGS_SECTIONS)[number];
export type CommunitySettingsDestination = "admin" | "moderator" | "member" | "visitor";

const modalSectionMap: Readonly<Record<UserSettingsSection, SettingsSection>> = {
  Account: "Account",
  Profile: "Profile",
  "Privacy & Safety": "Privacy & Safety",
  Appearance: "Appearance",
  Accessibility: "Appearance",
  Notifications: "Notifications",
  "Voice & Audio": "Voice & Video",
  Keyboard: "Keyboard Shortcuts",
  Advanced: "Advanced",
  Diagnostics: "Diagnostics",
};

export const settingsNavigationPolicyService = {
  createGlobalUserSettingsRequest(section: UserSettingsSection = "Account") {
    return { source: "global-sidebar" as const, section, modalSection: modalSectionMap[section] };
  },
  resolveCommunityDestination(access: CommunityAccess): CommunitySettingsDestination {
    if ((access.isOwner || access.isAdmin) && access.canOpenAdminPanel) return "admin";
    if (access.isModerator && access.canOpenModeratorPanel) return "moderator";
    return access.isVisitor ? "visitor" : "member";
  },
};
