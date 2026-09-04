import { useCallback, useEffect, useState } from "react";
import type { Member } from "../types/community";
import type { FriendConnection, FriendRecommendation } from "../types/friends";
import { featureFlagService } from "../services/featureFlagService";
import { friendRecommendationService } from "../services/friends/friendRecommendationService";
import { userBlockingService } from "../services/userBlockingService";
import { useTranslation } from "../i18n";
import { AppIcon } from "./AppIcon";
import { UserAvatar } from "./UserAvatar";

type FriendRecommendationsRailProps = Readonly<{
  currentUserId: string;
  friends: readonly FriendConnection[];
  pendingFriendRequestCount: number;
  onOpenProfile: (member: Member) => void;
  onSendFriendRequest: (userId: string) => boolean | Promise<boolean>;
}>;

function toMember(recommendation: FriendRecommendation): Member {
  return {
    id: `friend-recommendation-${recommendation.userId}`,
    userId: recommendation.userId,
    displayName: recommendation.displayName,
    username: recommendation.username,
    avatarSeed: recommendation.displayName || recommendation.userId,
    avatarUrl: recommendation.avatarUrl,
    status: "offline",
    statusText: "",
    roleId: "member",
  };
}

function reasonCopy(
  t: (key: string, params?: Readonly<Record<string, string | number>>) => string,
  recommendation: FriendRecommendation,
): string {
  if (recommendation.reasonCode === "MUTUAL_FRIENDS" && recommendation.mutualFriendCount > 0) {
    return t("discover.friendRecommendationMutualFriends", { count: recommendation.mutualFriendCount });
  }
  if (recommendation.reasonCode === "SHARED_COMMUNITY" && recommendation.sharedCommunityCount > 0) return t("discover.friendRecommendationSharedCommunity");
  if (recommendation.reasonCode === "SHARED_INTERESTS") return t("discover.friendRecommendationSharedInterests");
  if (recommendation.reasonCode === "POPULAR_IN_NETWORK") return t("discover.friendRecommendationPopularInNetwork");
  return t("discover.friendRecommendationDiscovery");
}

export function FriendRecommendationsRail({
  currentUserId,
  friends,
  pendingFriendRequestCount,
  onOpenProfile,
  onSendFriendRequest,
}: FriendRecommendationsRailProps) {
  const { t } = useTranslation("feed");
  const [enabled, setEnabled] = useState(() => featureFlagService.isEnabled("FRIEND_RECOMMENDATIONS_ENABLED"));
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [recommendations, setRecommendations] = useState<readonly FriendRecommendation[]>([]);
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async (forceRefresh = false) => {
    if (!enabled) {
      setStatus("idle");
      setRecommendations([]);
      return;
    }
    setStatus("loading");
    const result = await friendRecommendationService.list({ limit: friendRecommendationService.defaultLimit, forceRefresh });
    if (!result.ok) {
      setRecommendations([]);
      setStatus("error");
      return;
    }
    const locallyBlocked = new Set(userBlockingService.listBlockedUserIds());
    setRecommendations(result.data.filter((recommendation) => recommendation.userId !== currentUserId && !locallyBlocked.has(recommendation.userId)));
    setStatus("ready");
  }, [currentUserId, enabled]);

  useEffect(() => featureFlagService.subscribe((snapshot) => {
    setEnabled(snapshot.flags.FRIEND_RECOMMENDATIONS_ENABLED);
  }), []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Friend state and local blocking are real-time invalidation boundaries. The
  // backend performs the final relationship/privacy check on every refresh.
  useEffect(() => {
    if (!enabled) return;
    friendRecommendationService.invalidate(currentUserId);
    void load(true);
  }, [currentUserId, enabled, friends, pendingFriendRequestCount, load]);

  useEffect(() => userBlockingService.subscribe(() => {
    const blocked = new Set(userBlockingService.listBlockedUserIds());
    setRecommendations((current) => current.filter((recommendation) => !blocked.has(recommendation.userId)));
    friendRecommendationService.invalidate(currentUserId);
  }), [currentUserId]);

  if (!enabled) return null;

  const dismiss = async (recommendation: FriendRecommendation) => {
    if (await friendRecommendationService.dismiss(recommendation.userId)) {
      setRecommendations((current) => current.filter((row) => row.userId !== recommendation.userId));
    }
  };

  const send = (recommendation: FriendRecommendation) => {
    setSentIds((current) => new Set(current).add(recommendation.userId));
    void Promise.resolve(onSendFriendRequest(recommendation.userId)).then((sent) => {
      if (sent) {
        void friendRecommendationService.recordEvent(recommendation.userId, "request_sent");
        setRecommendations((current) => current.filter((row) => row.userId !== recommendation.userId));
        return;
      }
      setSentIds((current) => {
        const next = new Set(current);
        next.delete(recommendation.userId);
        return next;
      });
    });
  };

  return (
    <section className="feed-rail-card friend-recommendations-section" aria-labelledby="friend-recommendations-title">
      <header className="feed-rail-section-header">
        <div>
          <p className="eyebrow">{t("discover.friendRecommendations")}</p>
          <strong id="friend-recommendations-title">{t("discover.friendRecommendations")}</strong>
        </div>
        <button
          type="button"
          className="friend-recommendation-refresh"
          onClick={() => void load(true)}
          disabled={status === "loading"}
          aria-label={t("discover.friendRecommendationRefreshAria")}
          title={t("discover.friendRecommendationRefresh")}
        >
          <AppIcon name="refresh" size="sm" />
        </button>
      </header>
      {status === "loading" ? (
        <div className="feed-friend-empty feed-friend-empty--loading" aria-busy="true">
          <span className="feed-recommendation-skeleton" />
          <span className="feed-recommendation-skeleton" />
          <span className="feed-recommendation-skeleton" />
        </div>
      ) : status === "error" ? (
        <div className="feed-friend-empty">
          <p>{t("discover.friendRecommendationError")}</p>
          <button type="button" onClick={() => void load(true)}>{t("discover.friendRecommendationRetry")}</button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="feed-friend-empty">
          <p>{t("discover.friendRecommendationsEmpty")}</p>
          <button type="button" onClick={() => void load(true)}>{t("discover.friendRecommendationRefresh")}</button>
        </div>
      ) : (
        <ul className="friend-recommendation-list" aria-live="polite">
          {recommendations.map((recommendation) => {
            const sent = sentIds.has(recommendation.userId);
            return (
              <li key={recommendation.userId} className="friend-recommendation-person">
                <button
                  type="button"
                  className="friend-recommendation-identity"
                  onClick={() => {
                    void friendRecommendationService.recordEvent(recommendation.userId, "profile_open");
                    onOpenProfile(toMember(recommendation));
                  }}
                >
                  <UserAvatar userId={recommendation.userId} displayName={recommendation.displayName} fallbackUrl={recommendation.avatarUrl} size={36} />
                  <span className="friend-recommendation-copy">
                    <strong>{recommendation.displayName}</strong>
                    <small>{reasonCopy(t, recommendation)}</small>
                  </span>
                </button>
                <span className="friend-recommendation-actions">
                  <button type="button" className={`friend-recommendation-action${sent ? " is-active" : ""}`} disabled={sent} onClick={() => send(recommendation)}>
                    {sent ? t("discover.friendRecommendationRequested") : t("discover.friendRecommendationAdd")}
                  </button>
                  <button type="button" className="friend-recommendation-dismiss" onClick={() => void dismiss(recommendation)} aria-label={t("discover.friendRecommendationDismiss", { name: recommendation.displayName })}>
                    <AppIcon name="close" size="xs" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
