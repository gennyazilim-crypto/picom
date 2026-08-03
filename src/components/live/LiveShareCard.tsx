import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LiveScreenShareStatus, LiveScreenShareSummary } from "../../types/liveScreenShare";
import { AppIcon } from "../AppIcon";
import { UserAvatar } from "../UserAvatar";

const MENU_WIDTH = 224;

const STATUS_LABEL: Record<LiveScreenShareStatus, string> = {
  starting: "STARTING",
  live: "LIVE",
  reconnecting: "RECONNECTING",
  ended: "ENDED",
  terminated: "REMOVED",
};

export const JOIN_BUTTON_LABEL: Record<LiveScreenShareStatus, string> = {
  starting: "Starting",
  live: "Join",
  reconnecting: "Join",
  ended: "Ended",
  terminated: "Removed",
};

export function broadcasterLabel(share: LiveScreenShareSummary): string {
  return share.broadcasterDisplayName || share.broadcasterUsername || "Picom member";
}

export function formatLiveDuration(startedAt: string, now: number = Date.now()): string {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "Live";
  const diffMinutes = Math.max(0, Math.floor((now - started) / 60_000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "Just started";
}

export function formatViewerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

export function LiveStatusBadge({ status }: { status: LiveScreenShareStatus }) {
  return (
    <span className={`live-badge live-badge--${status}`}>
      <span className="live-badge__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function LiveFriendViewerStack({ friendViewerIds }: { friendViewerIds?: readonly string[] }) {
  if (!friendViewerIds || friendViewerIds.length === 0) return null;
  const visible = friendViewerIds.slice(0, 3);
  const extra = friendViewerIds.length - visible.length;
  const label = friendViewerIds.length === 1 ? "1 friend watching" : `${friendViewerIds.length} friends watching`;
  return (
    <div className="live-friend-stack" role="img" aria-label={label} title={label}>
      {visible.map((id) => (
        <span key={id} className="live-friend-stack__avatar">
          <UserAvatar userId={id} displayName={id} size={22} />
        </span>
      ))}
      {extra > 0 ? <span className="live-friend-stack__more">+{extra}</span> : null}
    </div>
  );
}

export type LiveShareMenuActions = Readonly<{
  onOpenCommunity: (communityId: string, channelId?: string) => void;
  onOpenProfile: (userId: string) => void;
  onReport: (share: LiveScreenShareSummary) => void;
  onHideCommunity: (communityId: string) => void;
}>;

function clampMenuLeft(triggerRight: number): number {
  const maxLeft = window.innerWidth - MENU_WIDTH - 8;
  return Math.min(Math.max(8, triggerRight - MENU_WIDTH), maxLeft);
}

export function useLiveShareMoreMenu(share: LiveScreenShareSummary, actions: LiveShareMenuActions) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: clampMenuLeft(rect.right) });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className="live-more-trigger"
      aria-label={`More actions for ${share.title || "this live share"}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((value) => !value);
      }}
    >
      <AppIcon name="more" size="sm" />
    </button>
  );

  const menu =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div ref={menuRef} className="live-more-menu" role="menu" style={{ top: position.top, left: position.left }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                actions.onOpenCommunity(share.communityId);
              }}
            >
              <AppIcon name="users" size="sm" />
              Open community
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                actions.onOpenCommunity(share.communityId, share.channelId);
              }}
            >
              <AppIcon name="hash" size="sm" />
              Open channel
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                actions.onOpenProfile(share.broadcasterUserId);
              }}
            >
              <AppIcon name="user" size="sm" />
              Open broadcaster profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                actions.onReport(share);
              }}
            >
              <AppIcon name="bell" size="sm" />
              Report
            </button>
            <button
              type="button"
              role="menuitem"
              className="live-more-menu__danger"
              onClick={() => {
                setOpen(false);
                actions.onHideCommunity(share.communityId);
              }}
            >
              <AppIcon name="close" size="sm" />
              Hide community from Live
            </button>
          </div>,
          document.body,
        )
      : null;

  return { trigger, menu };
}

type PublisherCardFields = {
  languageCode?: string;
  tags?: readonly string[];
  publisherBadgeType?: string | null;
  contentWarning?: string | null;
  ageRestricted?: boolean;
};

export type LiveShareCardProps = LiveShareMenuActions & {
  share: LiveScreenShareSummary & PublisherCardFields;
  onJoin: (share: LiveScreenShareSummary) => void;
  following?: boolean;
  onToggleFollow?: (userId: string) => void | Promise<void>;
};

function publisherBadgeLabel(badgeType: string | null | undefined): string | null {
  if (!badgeType) return null;
  if (badgeType.includes("creator")) return "Creator";
  if (badgeType.includes("publisher")) return "Publisher";
  return badgeType;
}

export function LiveShareCard({
  share,
  onJoin,
  onOpenCommunity,
  onOpenProfile,
  onReport,
  onHideCommunity,
  following = false,
  onToggleFollow,
}: LiveShareCardProps) {
  const [, forceTick] = useState(0);
  const { trigger, menu } = useLiveShareMoreMenu(share, { onOpenCommunity, onOpenProfile, onReport, onHideCommunity });

  useEffect(() => {
    if (share.status !== "live" && share.status !== "reconnecting") return;
    const timer = window.setInterval(() => forceTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [share.status]);

  const joinable = share.status === "live" || share.status === "reconnecting";
  const title = share.title || "Untitled stream";
  const broadcaster = broadcasterLabel(share);
  const category = share.category.replace(/_/g, " ");
  const duration = formatLiveDuration(share.startedAt);
  const badge = publisherBadgeLabel(share.publisherBadgeType);
  const tags = share.tags ?? [];

  return (
    <article
      className={`live-card live-card--${share.status}`}
      aria-label={`${broadcaster} is live — ${title} — ${share.viewerCount} watching`}
    >
      <button
        type="button"
        className="live-card__thumb"
        disabled={!joinable}
        onClick={() => onJoin(share)}
        aria-label={joinable ? `Watch ${title}` : `${title} is ${JOIN_BUTTON_LABEL[share.status].toLowerCase()}`}
      >
        <div className="live-card__thumb-fallback" aria-hidden="true">
          <AppIcon name="live" size="xl" />
        </div>
        <div className="live-card__thumb-topline">
          <LiveStatusBadge status={share.status} />
          <LiveFriendViewerStack friendViewerIds={share.friendViewerIds} />
        </div>
        <span className="live-card__viewers" title={`${share.viewerCount} viewers`}>
          <AppIcon name="eye" size="xs" aria-hidden="true" />
          {formatViewerCount(share.viewerCount)}
        </span>
        <span className="live-card__duration" title="Live duration">
          {duration}
        </span>
      </button>
      <div className="live-card__body">
        <h3 className="live-card__title" title={title}>
          {title}
        </h3>
        <div className="live-card__broadcaster-row">
          <button
            type="button"
            className="live-card__broadcaster"
            onClick={() => onOpenProfile(share.broadcasterUserId)}
            aria-label={`Open ${broadcaster} profile`}
          >
            <UserAvatar userId={share.broadcasterUserId} displayName={broadcaster} size={26} />
            <span>{broadcaster}</span>
          </button>
          {badge ? (
            <span className="live-badge-verified" title={badge} aria-label={badge}>
              <span aria-hidden="true">✓</span>
              <span>{badge}</span>
            </span>
          ) : null}
          <span className="live-card__more">{trigger}</span>
        </div>
        <div className="live-card__meta">
          <span className="live-card__category">{category}</span>
          {share.languageCode ? (
            <>
              <span className="live-card__meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="live-card__language">{share.languageCode}</span>
            </>
          ) : null}
          {share.communityName ? (
            <>
              <span className="live-card__meta-sep" aria-hidden="true">
                ·
              </span>
              <button type="button" className="live-card__community" onClick={() => onOpenCommunity(share.communityId, share.channelId)}>
                {share.communityName}
              </button>
            </>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <ul className="live-card__tags" aria-label="Tags">
            {tags.slice(0, 4).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
        {share.ageRestricted || share.contentWarning ? (
          <p className="live-card__warning" role="note">
            {share.contentWarning || "Age-restricted content"}
          </p>
        ) : null}
        <div className="live-card__actions">
          {onToggleFollow ? (
            <button
              type="button"
              className="live-card__follow"
              aria-pressed={following}
              onClick={() => void onToggleFollow(share.broadcasterUserId)}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
          <button
            type="button"
            className="live-card__join"
            disabled={!joinable}
            onClick={() => onJoin(share)}
            aria-label={joinable ? `Watch ${title}` : `${title} is ${JOIN_BUTTON_LABEL[share.status].toLowerCase()}`}
          >
            <AppIcon name="play" size="xs" aria-hidden="true" />
            {joinable ? "Watch" : JOIN_BUTTON_LABEL[share.status]}
          </button>
        </div>
      </div>
      {menu}
    </article>
  );
}
