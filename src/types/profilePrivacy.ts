export type ProfileVisibility = "everyone" | "shared_communities" | "friends";
export type ProfilePrivacySettings = Readonly<{
  visibility: ProfileVisibility;
  showOnlineStatus: boolean;
  showLocation: boolean;
  showTimezone: boolean;
  showActivity: boolean;
  showMedia: boolean;
  showCommunities: boolean;
  showFriends: boolean;
  showFollows: boolean;
  showAudio: boolean;
}>;
export type ProfilePrivacyProjection = Readonly<ProfilePrivacySettings & {
  canViewProfile: boolean;
  location?: string;
  timezone?: string;
}>;
