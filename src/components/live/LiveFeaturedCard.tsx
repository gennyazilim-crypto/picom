import { useEffect, useState } from "react";
import type { LiveScreenShareSummary } from "../../types/liveScreenShare";
import { AppIcon } from "../AppIcon";
import { UserAvatar } from "../UserAvatar";
import { categoryLabel } from "./liveDiscoveryModel";
import {
  broadcasterLabel,
  formatLiveDuration,
  formatViewerCount,
  LiveFriendViewerStack,
  LiveStatusBadge,
  useLiveShareMoreMenu,
  type LiveShareCardProps,
} from "./LiveShareCard";

export type LiveFeaturedHeroProps = LiveShareCardProps & {
  following?: boolean;
  onToggleFollow?: (userId: string) => void | Promise<void>;
};

export function LiveFeaturedCard({
  share,
  onJoin,
  onOpenCommunity,
  onOpenProfile,
  onReport,
  onHideCommunity,
  following = false,
  onToggleFollow,
}: LiveFeaturedHeroProps) {
  const [, tick] = useState(0);
  const { trigger, menu } = useLiveShareMoreMenu(share, { onOpenCommunity, onOpenProfile, onReport, onHideCommunity });
  const joinable = share.status === "live" || share.status === "reconnecting";
  const title = share.title || "Untitled screen share";
  const broadcaster = broadcasterLabel(share);
  const friendsLabel =
    share.friendViewerIds.length === 0
      ? null
      : share.friendViewerIds.length === 1
        ? "1 friend here"
        : `${share.friendViewerIds.length} friends here`;

  useEffect(() => {
    if (!joinable) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [joinable]);

  return (
    <article
      className={`live-hero live-hero--${share.status}`}
      aria-label="Featured live stream"
    >
      <div className="live-hero__stage">
        <div className="live-hero__media" aria-hidden="true">
          <span className="live-hero__media-fallback">
            <AppIcon name="live" size="xl" />
          </span>
        </div>
        <div className="live-hero__overlay" aria-hidden="true" />

        <div className="live-hero__top-left">
          <LiveStatusBadge status={share.status} />
          <span className="live-hero__category-chip">{categoryLabel(share.category)}</span>
          {friendsLabel ? (
            <span className="live-hero__friends-chip">
              <LiveFriendViewerStack friendViewerIds={share.friendViewerIds} />
              <span>{friendsLabel}</span>
            </span>
          ) : null}
        </div>

        <div className="live-hero__top-right">
          <span className="live-hero__more">{trigger}</span>
        </div>

        <div className="live-hero__meta">
          <div className="live-hero__identity">
            <button
              type="button"
              className="live-hero__avatar-btn"
              onClick={() => onOpenProfile(share.broadcasterUserId)}
              aria-label={`Open ${broadcaster} profile`}
            >
              <UserAvatar userId={share.broadcasterUserId} displayName={broadcaster} size={48} />
            </button>
            <div className="live-hero__identity-copy">
              <button type="button" className="live-hero__name" onClick={() => onOpenProfile(share.broadcasterUserId)}>
                {broadcaster}
              </button>
              <button
                type="button"
                className="live-hero__community"
                onClick={() => onOpenCommunity(share.communityId, share.channelId)}
              >
                <span>{share.communityName}</span>
                <AppIcon name="chevronRight" size="xs" aria-hidden="true" />
                <span className="live-hero__channel">#{share.channelName}</span>
              </button>
            </div>
          </div>

          <h2 className="live-hero__title" title={title}>
            {title}
          </h2>

          <div className="live-hero__stats" aria-label="Live stats">
            <span className="live-hero__stat-chip">{categoryLabel(share.category)}</span>
            <span title={`${share.viewerCount} viewers`}>
              <AppIcon name="eye" size="sm" aria-hidden="true" />
              {formatViewerCount(share.viewerCount)} viewers
            </span>
            <span title="Live duration">
              <AppIcon name="calendar" size="sm" aria-hidden="true" />
              {formatLiveDuration(share.startedAt)}
            </span>
            <span title={`${share.participantCount} in call`}>
              <AppIcon name="users" size="sm" aria-hidden="true" />
              {share.participantCount} in call
            </span>
          </div>

          <div className="live-hero__cta-row">
            <button
              type="button"
              className="live-hero__cta live-hero__cta--primary"
              disabled={!joinable}
              onClick={() => onJoin(share)}
              aria-label={joinable ? `Watch ${title} now` : `${title} is unavailable`}
            >
              <AppIcon name="play" size="md" aria-hidden="true" />
              {joinable ? "Watch Now" : "Unavailable"}
            </button>
            {onToggleFollow ? (
              <button
                type="button"
                className="live-hero__cta live-hero__cta--secondary"
                aria-pressed={following}
                onClick={() => void onToggleFollow(share.broadcasterUserId)}
              >
                {following ? "Following" : "Follow"}
              </button>
            ) : null}
            <button
              type="button"
              className="live-hero__cta live-hero__cta--ghost"
              onClick={() => onOpenCommunity(share.communityId, share.channelId)}
            >
              Open Community
              <AppIcon name="chevronRight" size="sm" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {menu}
    </article>
  );
}

export function LiveFeaturedEmpty() {
  return (
    <div className="live-hero live-hero--empty" role="region" aria-label="Featured live stream">
      <div className="live-hero__stage live-hero__stage--empty">
        <div className="live-hero__empty-copy">
          <AppIcon name="live" size="xl" aria-hidden="true" />
          <strong>No featured streams right now</strong>
          <span>Check back soon — live shares from communities you can access appear here.</span>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer LiveFeaturedCard hero props; kept for type re-exports. */
export type { LiveScreenShareSummary };
