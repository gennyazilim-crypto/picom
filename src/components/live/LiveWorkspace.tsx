import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveScreenShareCategory, LiveScreenShareFilter, LiveScreenShareSort, LiveScreenShareSummary } from "../../types/liveScreenShare";
import { liveScreenShareService } from "../../services/live/liveScreenShareService";
import { AppIcon } from "../AppIcon";
import { LiveCategoryRail } from "./LiveCategoryRail";
import { LiveDiscoverySection } from "./LiveDiscoverySection";
import { LiveFeaturedCard, LiveFeaturedEmpty } from "./LiveFeaturedCard";
import { LiveFeaturedSelector } from "./LiveFeaturedSelector";
import { LiveShareCard, broadcasterLabel } from "./LiveShareCard";
import { partitionLiveDiscovery } from "./liveDiscoveryModel";
import { consumeDiscoveryRestoreState, saveDiscoveryRestoreState } from "./liveWatchModel";
import "./liveWorkspace.css";

const LIST_LIMIT = 60;
const REALTIME_RELOAD_DEBOUNCE_MS = 800;

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error" | "disconnected";

function connectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Synced";
    case "connecting":
    case "reconnecting":
      return "Syncing…";
    case "error":
      return "Sync error";
    case "disconnected":
    default:
      return "Offline";
  }
}

function isLiveFilter(value: string): value is LiveScreenShareFilter {
  return ["all", "member", "following", "friends_watching", "game", "chat", "education", "watch_together", "other"].includes(value);
}

function isLiveCategory(value: string | null): value is LiveScreenShareCategory {
  return value === "game" || value === "chat" || value === "education" || value === "watch_together" || value === "other";
}

export type LiveWorkspaceProps = Readonly<{
  currentUserId: string;
  followedUserIds?: readonly string[];
  onToggleFollow?: (userId: string) => void | Promise<void>;
  onJoinLive: (share: LiveScreenShareSummary) => void;
  onOpenCommunity: (communityId: string, channelId?: string) => void;
  onOpenProfile: (userId: string) => void;
  onNotice: (message: string, kind?: "info" | "error" | "success") => void;
  onBrowseCommunities?: () => void;
  onFindFriends?: () => void;
  onOpenGoLive?: () => void;
}>;

export function LiveWorkspace({
  currentUserId,
  followedUserIds = [],
  onToggleFollow,
  onJoinLive,
  onOpenCommunity,
  onOpenProfile,
  onNotice,
  onBrowseCommunities,
  onFindFriends,
  onOpenGoLive,
}: LiveWorkspaceProps) {
  const restored = useMemo(() => consumeDiscoveryRestoreState(), []);
  const [query, setQuery] = useState(restored?.query ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(restored?.query ?? "");
  const [filter, setFilter] = useState<LiveScreenShareFilter>(() => (restored && isLiveFilter(restored.filter) ? restored.filter : "all"));
  const [categoryFilter, setCategoryFilter] = useState<LiveScreenShareCategory | null>(() => (restored && isLiveCategory(restored.categoryFilter) ? restored.categoryFilter : null));
  const [sort] = useState<LiveScreenShareSort>("recommended");
  const [shares, setShares] = useState<readonly LiveScreenShareSummary[]>([]);
  const [memberShares, setMemberShares] = useState<readonly LiveScreenShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [reloadToken, setReloadToken] = useState(0);
  const [featuredOverrideId, setFeaturedOverrideId] = useState<string | null>(restored?.featuredOverrideId ?? null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      liveScreenShareService.listVisibleLiveShares({ filter, sort, limit: LIST_LIMIT }),
      liveScreenShareService.listVisibleLiveShares({ filter: "member", sort: "recommended", limit: LIST_LIMIT }),
    ]).then(([allResult, memberResult]) => {
      if (!active) return;
      if (allResult.ok) {
        setShares(allResult.data.items);
        setConnectionStatus("connected");
      } else {
        setShares([]);
        setLoadError(allResult.error.message);
        setConnectionStatus(allResult.error.code === "DATA_SOURCE_NOT_CONFIGURED" ? "disconnected" : "error");
      }
      setMemberShares(memberResult.ok ? memberResult.data.items : []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filter, sort, reloadToken]);

  useEffect(() => {
    let debounceTimer: number | null = null;
    const triggerReload = () => {
      setConnectionStatus((current) => (current === "error" || current === "disconnected" ? current : "reconnecting"));
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => setReloadToken((value) => value + 1), REALTIME_RELOAD_DEBOUNCE_MS);
    };
    const unsubscribe = liveScreenShareService.subscribeToVisibleLiveShares(triggerReload);
    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, []);

  const sanitized = useMemo(() => {
    const normalized = debouncedQuery.toLowerCase();
    const withoutSelf = shares.map((share) => ({
      ...share,
      friendViewerIds: share.friendViewerIds.filter((id) => id !== currentUserId),
    }));
    const textFiltered = !normalized
      ? withoutSelf
      : withoutSelf.filter(
          (share) =>
            share.title.toLowerCase().includes(normalized) ||
            share.communityName.toLowerCase().includes(normalized) ||
            share.channelName.toLowerCase().includes(normalized) ||
            broadcasterLabel(share).toLowerCase().includes(normalized),
        );
    return categoryFilter ? textFiltered.filter((share) => share.category === categoryFilter) : textFiltered;
  }, [shares, debouncedQuery, currentUserId, categoryFilter]);

  const memberSanitized = useMemo(
    () =>
      memberShares.map((share) => ({
        ...share,
        friendViewerIds: share.friendViewerIds.filter((id) => id !== currentUserId),
      })),
    [memberShares, currentUserId],
  );

  const discovery = useMemo(
    () => partitionLiveDiscovery(sanitized, { memberItems: memberSanitized }),
    [sanitized, memberSanitized],
  );

  const featured =
    (featuredOverrideId ? sanitized.find((share) => share.id === featuredOverrideId) : null)
    ?? discovery.featured;

  const hasFilters = Boolean(debouncedQuery || filter !== "all" || categoryFilter);
  const liveCount = discovery.activeGrid.length;
  const liveCountLabel = liveCount === 1 ? "1 live now" : `${liveCount} live now`;
  const reload = () => setReloadToken((value) => value + 1);

  useEffect(() => {
    if (!restored?.scrollTop) return;
    const node = scrollRef.current;
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = restored.scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [restored, loading]);

  const joinShare = async (share: LiveScreenShareSummary) => {
    if (share.status === "terminated") {
      onNotice("This live share was removed.", "error");
      return;
    }
    if (share.status === "ended") {
      onNotice("This live share has ended.", "info");
      return;
    }
    saveDiscoveryRestoreState({
      query,
      filter,
      categoryFilter,
      featuredOverrideId,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    });
    onJoinLive(share);
  };

  const reportShare = async (share: LiveScreenShareSummary) => {
    const result = await liveScreenShareService.reportLiveShare(share.id, "Reported from the Live browse view.");
    onNotice(result.ok ? "Report sent. Thanks for helping keep Picom safe." : result.error.message, result.ok ? "success" : "error");
  };

  const hideCommunity = async (communityId: string) => {
    const communityName = shares.find((share) => share.communityId === communityId)?.communityName || "This community";
    const result = await liveScreenShareService.hideLiveCommunity(communityId);
    if (result.ok) {
      setShares((current) => current.filter((share) => share.communityId !== communityId));
      setMemberShares((current) => current.filter((share) => share.communityId !== communityId));
      onNotice(`Hid ${communityName} from Live.`, "success");
    } else {
      onNotice(result.error.message, "error");
    }
  };

  const cardActions = {
    onJoin: joinShare,
    onOpenCommunity,
    onOpenProfile,
    onReport: reportShare,
    onHideCommunity: hideCommunity,
  } as const;

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setCategoryFilter(null);
  };

  const renderCards = (items: readonly LiveScreenShareSummary[], className = "live-section__cards") => (
    <div className={className}>
      {items.map((share) => (
        <LiveShareCard key={share.id} share={share} {...cardActions} />
      ))}
    </div>
  );

  return (
    <main className="live-workspace" role="main" aria-label="Live Now" aria-labelledby="live-workspace-title">
      <header className="live-workspace__header">
        <div className="live-workspace__intro">
          <div className="live-workspace__title-row">
            <span className="live-workspace__mark" aria-hidden="true">
              <span className="live-workspace__mark-ring" />
              <AppIcon name="live" size="lg" />
            </span>
            <div className="live-workspace__titles">
              <div className="live-workspace__eyebrow-row">
                <span className="live-workspace__eyebrow">
                  <span className="live-workspace__eyebrow-dot" aria-hidden="true" />
                  Live Now
                </span>
                <span className="live-workspace__count-pill" aria-live="polite">
                  {loading ? "Updating…" : liveCountLabel}
                </span>
              </div>
              <h1 id="live-workspace-title">Live Now</h1>
            </div>
          </div>
          <p className="live-workspace__lede">Discover screens being shared in communities you can access.</p>
        </div>
        <div className="live-workspace__actions">
          <p className={`live-workspace__status live-workspace__status--${connectionStatus}`} role="status">
            <span className="live-workspace__status-dot" aria-hidden="true" />
            {connectionLabel(connectionStatus)}
          </p>
          {onOpenGoLive ? (
            <button type="button" className="live-workspace__refresh" onClick={onOpenGoLive} aria-label="Go Live — start a broadcast">
              <AppIcon name="live" size="sm" aria-hidden="true" />
              <span>Yayın Aç</span>
            </button>
          ) : null}
          <button
            type="button"
            className={`live-workspace__refresh${loading ? " live-workspace__refresh--busy" : ""}`}
            onClick={reload}
            disabled={loading}
            aria-label={loading ? "Refreshing live shares" : "Refresh live shares"}
          >
            <AppIcon name="refresh" size="sm" aria-hidden="true" />
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {connectionStatus === "reconnecting" ? (
        <div className="live-workspace__reconnect" role="status" aria-live="polite">
          Reconnecting to Live updates…
        </div>
      ) : null}

      <div className="live-workspace__toolbar">
        <label className="live-workspace__search">
          <span className="live-workspace__search-icon" aria-hidden="true">
            <AppIcon name="search" size="sm" />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, community, channel or broadcaster"
            aria-label="Search live shares"
          />
          {query ? (
            <button type="button" className="live-workspace__search-clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <AppIcon name="close" size="xs" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="live-workspace__body live-workspace__body--discovery" ref={scrollRef}>
        {loadError ? (
          <div className="live-error" role="alert">
            <span className="live-error__mark" aria-hidden="true">
              <AppIcon name="live" size="xl" />
            </span>
            <strong>Live could not be loaded</strong>
            <p>{loadError}</p>
            <button type="button" className="live-error__retry" onClick={reload}>
              Retry
            </button>
          </div>
        ) : loading && shares.length === 0 ? (
          <div className="live-loading" role="status">
            Loading live shares…
          </div>
        ) : discovery.activeGrid.length === 0 ? (
          <div className={`live-empty${hasFilters ? " live-empty--filtered" : ""}`} role="status">
            <div className="live-empty__glow" aria-hidden="true" />
            <span className="live-empty__mark" aria-hidden="true">
              <span className="live-empty__mark-ring" />
              <AppIcon name="live" size="xl" />
            </span>
            <p className="live-empty__eyebrow">{hasFilters ? "No matches" : "Waiting for signal"}</p>
            <div className="live-empty__copy">
              <strong>{hasFilters ? "No live shares match your filters" : "Nothing is live right now"}</strong>
              <span>
                {hasFilters
                  ? "Try a different search term or category to discover active screen shares."
                  : "Follow communities or creators to personalise Live Now. When someone shares a screen you can access, it will show up here."}
              </span>
            </div>
            <div className="live-empty__actions">
              {hasFilters ? (
                <button type="button" className="live-empty__cta live-empty__cta--ghost" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
              {onBrowseCommunities ? (
                <button type="button" className="live-empty__cta" onClick={onBrowseCommunities}>
                  Explore Communities
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <section className="live-workspace__hero-block">
              {featured ? (
                <LiveFeaturedCard
                  share={featured}
                  {...cardActions}
                  following={followedUserIds.includes(featured.broadcasterUserId)}
                  onToggleFollow={onToggleFollow}
                />
              ) : (
                <LiveFeaturedEmpty />
              )}
              <LiveFeaturedSelector
                items={discovery.featuredSelectors}
                selectedId={featured?.id ?? null}
                onSelect={(share) => setFeaturedOverrideId(share.id)}
              />
            </section>

            {discovery.categories.length > 0 ? (
              <LiveDiscoverySection id="categories" title="Categories" icon="hash">
                <LiveCategoryRail
                  buckets={discovery.categories}
                  activeCategory={categoryFilter}
                  onSelect={setCategoryFilter}
                />
              </LiveDiscoverySection>
            ) : null}

            <LiveDiscoverySection
              id="active-grid"
              title="Live Now"
              icon="live"
              onShowAll={clearFilters}
              showAllLabel="Reset filters"
            >
              {renderCards(discovery.activeGrid, "live-grid live-grid--discovery")}
            </LiveDiscoverySection>

            <LiveDiscoverySection
              id="member-communities"
              title="Live in your communities"
              icon="users"
              onShowAll={() => setFilter("member")}
              empty={
                <div className="live-section__empty">
                  <strong>None of your communities are live right now.</strong>
                  {onBrowseCommunities ? (
                    <button type="button" className="live-section__link" onClick={onBrowseCommunities}>
                      Browse all communities
                    </button>
                  ) : null}
                </div>
              }
            >
              {discovery.memberLive.length > 0 ? renderCards(discovery.memberLive) : null}
            </LiveDiscoverySection>

            <LiveDiscoverySection
              id="friends-watching"
              title="Friends watching"
              icon="users"
              hiddenWhenEmpty
              onShowAll={() => setFilter("friends_watching")}
            >
              {discovery.friendsWatching.length > 0 ? renderCards(discovery.friendsWatching) : null}
            </LiveDiscoverySection>

            <LiveDiscoverySection
              id="rising-fast"
              title="Rising fast"
              icon="live"
              variant="rising"
              hiddenWhenEmpty
              onShowAll={() => {
                setFilter("all");
                setCategoryFilter(null);
              }}
            >
              {discovery.risingFast.length > 0 ? renderCards(discovery.risingFast) : null}
            </LiveDiscoverySection>

            <LiveDiscoverySection
              id="just-started"
              title="Just started"
              icon="calendar"
              variant="fresh"
              hiddenWhenEmpty
              onShowAll={() => {
                setFilter("all");
                setCategoryFilter(null);
              }}
            >
              {discovery.justStarted.length > 0
                ? renderCards(discovery.justStarted, "live-section__cards live-section__cards--fresh")
                : null}
            </LiveDiscoverySection>
          </>
        )}
      </div>
    </main>
  );
}
