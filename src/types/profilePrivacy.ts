export type ProfileVisibility = "everyone" | "shared_communities" | "friends";
export type ProfilePrivacySettings = Readonly<{ visibility: ProfileVisibility; showLocation: boolean; showTimezone: boolean; showActivity: boolean; showMedia: boolean }>;
export type ProfilePrivacyProjection = Readonly<{ canViewProfile: boolean; showLocation: boolean; showTimezone: boolean; showActivity: boolean; showMedia: boolean; location?: string; timezone?: string }>;
