import { AppIcon } from "../AppIcon";
import { UserAvatar } from "../UserAvatar";
import type { LiveScreenShareSummary } from "../../types/liveScreenShare";
import { broadcasterLabel } from "./LiveShareCard";
import { categoryLabel, formatWatchViewerCount } from "./liveWatchModel";

export type LiveWatchInfoProps = Readonly<{
  session: LiveScreenShareSummary;
  durationLabel: string;
  isFollowing: boolean;
  followBusy: boolean;
  isSelf: boolean;
  canModerateLive?: boolean;
  onToggleFollow: () => void;
  onOpenCommunity: () => void;
  onOpenProfile: () => void;
  onShare: () => void;
  onReport: () => void;
  onForceEnd?: () => void;
  onRemoveBroadcaster?: () => void;
  onOpenModerationCase?: () => void;
}>;

export function LiveWatchInfo({
  session,
  durationLabel,
  isFollowing,
  followBusy,
  isSelf,
  canModerateLive = false,
  onToggleFollow,
  onOpenCommunity,
  onOpenProfile,
  onShare,
  onReport,
  onForceEnd,
  onRemoveBroadcaster,
  onOpenModerationCase,
}: LiveWatchInfoProps) {
  const viewerLabel = formatWatchViewerCount(session.viewerCount);
  const name = broadcasterLabel(session);
  const metaParts = [
    session.communityName || "Community",
    session.channelName || "Voice",
    categoryLabel(session.category),
    session.applicationName.trim() || null,
  ].filter(Boolean) as string[];

  return (
    <section className="live-watch-info" aria-label="Stream information">
      <div className="live-watch-info__identity">
        <button type="button" className="live-watch-info__avatar-btn" onClick={onOpenProfile} aria-label={`Open ${name} profile`}>
          <UserAvatar userId={session.broadcasterUserId} displayName={name} size={52} />
        </button>

        <div className="live-watch-info__copy">
          <h1 className="live-watch-info__title">{session.title.trim() || "Live screen share"}</h1>

          <div className="live-watch-info__name-row">
            <button type="button" className="live-watch-info__name" onClick={onOpenProfile}>
              {name}
            </button>
            {!isSelf ? (
              <button
                type="button"
                className={`live-watch-btn live-watch-btn--compact ${isFollowing ? "live-watch-btn--ghost" : "live-watch-btn--primary"}`}
                onClick={onToggleFollow}
                disabled={followBusy}
                aria-pressed={isFollowing}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            ) : null}
          </div>

          <p className="live-watch-info__meta" aria-label="Stream context">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`} className="live-watch-info__meta-item">
                {index === 0 ? (
                  <button type="button" className="live-watch-info__link" onClick={onOpenCommunity}>
                    {part}
                  </button>
                ) : (
                  part
                )}
              </span>
            ))}
          </p>

          <div className="live-watch-info__stats" aria-label="Stream stats">
            <span className="live-watch-info__stat">
              <AppIcon name="eye" size="xs" />
              {viewerLabel ? `${viewerLabel} watching` : "—"}
            </span>
            <span className="live-watch-info__stat">
              <AppIcon name="live" size="xs" />
              {durationLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="live-watch-info__toolbar" role="group" aria-label="Stream actions">
        <div className="live-watch-info__toolbar-primary">
          <button type="button" className="live-watch-btn live-watch-btn--primary" onClick={onOpenCommunity}>
            <AppIcon name="users" size="xs" />
            Open community
          </button>
          <button type="button" className="live-watch-btn live-watch-btn--ghost" onClick={onShare} aria-label="Share stream">
            Share
          </button>
          <button type="button" className="live-watch-btn live-watch-btn--ghost" onClick={onReport} aria-label="Report stream">
            Report
          </button>
          {canModerateLive && onOpenModerationCase ? (
            <button type="button" className="live-watch-btn live-watch-btn--ghost" onClick={onOpenModerationCase}>
              Moderation case
            </button>
          ) : null}
        </div>

        {canModerateLive && (onForceEnd || onRemoveBroadcaster) ? (
          <div className="live-watch-info__toolbar-mod" role="group" aria-label="Moderation actions">
            {onForceEnd ? (
              <button type="button" className="live-watch-btn live-watch-btn--danger" onClick={onForceEnd}>
                End stream
              </button>
            ) : null}
            {onRemoveBroadcaster ? (
              <button type="button" className="live-watch-btn live-watch-btn--danger" onClick={onRemoveBroadcaster}>
                Remove from voice
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LiveWatchAbout({
  session,
  onOpenCommunity,
  onOpenProfile,
}: Readonly<{
  session: LiveScreenShareSummary;
  onOpenCommunity: () => void;
  onOpenProfile: () => void;
}>) {
  return (
    <section className="live-watch-about" aria-label="About this stream">
      <div className="live-watch-about__card">
        <h2>About</h2>
        <p>
          {session.title.trim()
            ? `${broadcasterLabel(session)} is live with “${session.title.trim()}” in ${session.communityName || "their community"}.`
            : `${broadcasterLabel(session)} is sharing their screen live with the community.`}
        </p>
        <dl className="live-watch-about__facts">
          <div>
            <dt>Community</dt>
            <dd>
              <button type="button" className="live-watch-info__link" onClick={onOpenCommunity}>
                {session.communityName || "Open community"}
              </button>
            </dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>{session.channelName || "Voice room"}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{categoryLabel(session.category)}</dd>
          </div>
          <div>
            <dt>Broadcaster</dt>
            <dd>
              <button type="button" className="live-watch-info__link" onClick={onOpenProfile}>
                {broadcasterLabel(session)}
              </button>
            </dd>
          </div>
        </dl>
      </div>
      <div className="live-watch-about__card live-watch-about__card--cta">
        <h2>Community</h2>
        <p>
          PICOM Live stays connected to the community voice room. Open the community for rules, members, and the full channel conversation.
        </p>
        <button type="button" className="live-watch-btn live-watch-btn--primary" onClick={onOpenCommunity}>
          Open community
        </button>
      </div>
    </section>
  );
}
