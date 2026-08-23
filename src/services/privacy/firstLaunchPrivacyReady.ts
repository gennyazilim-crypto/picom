import type { AccountPrivacySnapshot, FirstLaunchPrivacyReadyStatus } from "./accountPrivacySetupService";

const FRIEND_LABELS = {
  everyone: "privacy.friendRequests.everyone",
  community_members: "privacy.friendRequests.communityMembers",
  friends_of_friends: "privacy.friendRequests.friendsOfFriends",
  nobody: "privacy.friendRequests.nobody",
} as const;

const DIRECT_LABELS = {
  everyone: "privacy.dm.everyone",
  friends: "privacy.dm.friends",
  no_one: "privacy.dm.noOne",
} as const;

const PROFILE_LABELS = {
  everyone: "privacy.profile.everyone",
  shared_communities: "privacy.profile.sharedCommunities",
  friends: "privacy.profile.friends",
} as const;

export function firstLaunchPrivacyReadyKeys(snapshot: AccountPrivacySnapshot): Readonly<{
  friendRequestKey: string;
  directMessageKey: string;
  profileKey: string;
  presenceKey: string;
}> {
  return {
    friendRequestKey: FRIEND_LABELS[snapshot.friendRequestPrivacy],
    directMessageKey: DIRECT_LABELS[snapshot.directMessagePrivacy],
    profileKey: PROFILE_LABELS[snapshot.profile.visibility],
    presenceKey: snapshot.profile.showOnlineStatus ? "privacy.presence.show" : "privacy.presence.hide",
  };
}

export function firstLaunchPrivacyReadyLabel(
  summary: FirstLaunchPrivacyReadyStatus | null,
  skipped: boolean,
  t: (key: string) => string,
): ReadonlyArray<Readonly<{ term: string; value: string }>> {
  if (skipped) return [{ term: t("ready.privacy"), value: t("ready.privacySkipped") }];
  if (!summary || summary.status === "anonymous") return [{ term: t("ready.privacy"), value: t("privacy.reviewAfterSignIn") }];
  if (summary.status !== "ready") return [{ term: t("ready.privacy"), value: summary.status === "unavailable" ? t("privacy.loadFailed") : t("ready.privacySkipped") }];
  const keys = firstLaunchPrivacyReadyKeys(summary.snapshot);
  return [
    { term: t("ready.privacyFriendRequests"), value: t(keys.friendRequestKey) },
    { term: t("ready.privacyDirectMessages"), value: t(keys.directMessageKey) },
    { term: t("ready.privacyProfile"), value: t(keys.profileKey) },
    { term: t("ready.privacyPresence"), value: t(keys.presenceKey) },
  ];
}
