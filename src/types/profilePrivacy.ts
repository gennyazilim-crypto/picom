export type ProfileVisibility = "everyone" | "shared_communities" | "friends";
export type ProfilePrivacySettings = Readonly<{ visibility: ProfileVisibility; showOnlineStatus: boolean; showLocation: boolean; showTimezone: boolean; showActivity: boolean; showMedia: boolean }>;
export type ProfilePrivacyProjection = Readonly<{ canViewProfile: boolean; showOnlineStatus: boolean; showLocation: boolean; showTimezone: boolean; showActivity: boolean; showMedia: boolean; location?: string; timezone?: string }>;
