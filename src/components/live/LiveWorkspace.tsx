import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveScreenShareCategory, LiveScreenShareSummary } from "../../types/liveScreenShare";
import {
  publisherLiveNowService,
  type PublisherLiveCategoryCount,
  type PublisherLiveNowSort,
  type PublisherLiveNowSummary,
  type UpcomingPublisherSchedule,
} from "../../services/live/publisherLiveNowService";
import { publisherProgramService } from "../../services/publisher/publisherProgramService";
import {
  resolveCtaStateFromProgram,
  resolveLiveNowCtaActions,
  type LiveNowCtaAction,
  type LiveNowCtaState,
} from "../../services/publisher/liveNowCtaState";
import { localizationService } from "../../services/localizationService";
import { translateLiveNow, type LiveNowI18nKey } from "../../services/localization/liveNowCatalog";
import { AppIcon } from "../AppIcon";
import { LiveCategoryRail } from "./LiveCategoryRail";
import { LiveDiscoverySection } from "./LiveDiscoverySection";
import { LiveFeaturedCard } from "./LiveFeaturedCard";
import { LiveShareCard, broadcasterLabel } from "./LiveShareCard";
import { buildCategoryBuckets, isJustStarted } from "./liveDiscoveryModel";
import { consumeDiscoveryRestoreState, saveDiscoveryRestoreState } from "./liveWatchModel";
import "./liveWorkspace.css";

const LIST_LIMIT = 24;
const REALTIME_RELOAD_DEBOUNCE_MS = 800;
const STALE_AFTER_MS = 45_000;

type ConnectionStatus = "connected" | "reconnecting" | "disconnected" | "stale";

function t(key: LiveNowI18nKey, vars?: Readonly<Record<string, string>>): string {
  return translateLiveNow(key, localizationService.getLanguage(), vars);
}

function ctaLabel(action: LiveNowCtaAction): string {
  switch (action.kind) {
    case "link":
      switch (action.key) {
        case "requirements":
          return t("live.now.cta.requirements");
        case "apply":
          return t("live.now.cta.apply");
        case "complete_application":
          return t("live.now.cta.completeApplication");
        case "complete_info":
          return t("live.now.cta.completeInfo");
        case "dashboard":
          return t("live.now.cta.dashboard");
        case "view_decision":
          return t("live.now.cta.viewDecision");
      }
      break;
    case "go_live":
      return t("live.now.cta.goLive");
    case "status_chip":
      return t("live.now.cta.underReview");
    case "account_message":
      return action.key === "suspended" ? t("live.now.cta.suspended") : t("live.now.cta.revoked");
  }
  return "";
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
  onOpenPublisherApply?: () => void;
  onOpenPublisherDashboard?: () => void;
  /** Discover publishers / friends surface for empty-state CTA */
  onDiscoverPublishers?: () => void;
}>;

export function LiveWorkspace({
  currentUserId,
  followedUserIds = [],
  onToggleFollow,
  onJoinLive,
  onOpenCommunity,
  onOpenProfile,
  onNotice,
  onFindFriends,
  onOpenGoLive,
  onOpenPublisherApply,
  onOpenPublisherDashboard,
  onDiscoverPublishers,
}: LiveWorkspaceProps) {
  const restored = useMemo(() => consumeDiscoveryRestoreState(), []);
  const [query, setQuery] = useState(restored?.query ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(restored?.query ?? "");
  const [categoryFilter, setCategoryFilter] = useState<LiveScreenShareCategory | null>(
    restored?.categoryFilter === "game" ||
      restored?.categoryFilter === "chat" ||
      restored?.categoryFilter === "education" ||
      restored?.categoryFilter === "watch_together" ||
      restored?.categoryFilter === "other"
      ? restored.categoryFilter
      : null,
  );
  const [languageFilter, setLanguageFilter] = useState("");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [sort, setSort] = useState<PublisherLiveNowSort>("viewers");
  const [shares, setShares] = useState<readonly PublisherLiveNowSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<{ startedAt: string; id: string } | null>(null);
  const [schedules, setSchedules] = useState<readonly UpcomingPublisherSchedule[]>([]);
  const [reminderEnabledIds, setReminderEnabledIds] = useState<ReadonlySet<string>>(new Set());
  const [reminderBusyId, setReminderBusyId] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<readonly PublisherLiveCategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; safeCode: string; forbidden?: boolean } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("reconnecting");
  const [reloadToken, setReloadToken] = useState(0);
  const [ctaState, setCtaState] = useState<LiveNowCtaState>("threshold_not_met");
  const [goLiveAllowed, setGoLiveAllowed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSuccessAtRef = useRef<number>(0);
  const announcedCountRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    void Promise.all([
      publisherLiveNowService.listPublisherLiveNow({
        limit: LIST_LIMIT,
        search: debouncedQuery || null,
        category: categoryFilter,
        language: languageFilter || null,
        followingOnly,
        sort,
      }),
      publisherLiveNowService.listUpcomingSchedules(12),
      publisherLiveNowService.listMyScheduleReminders(),
      publisherLiveNowService.listCategoryCounts(),
      publisherProgramService.getProgramState(),
      publisherProgramService.canStartLiveStream(),
    ]).then(([listResult, scheduleResult, reminderResult, categoryResult, programResult, preflightResult]) => {
      if (!active) return;

      if (!listResult.ok) {
        setShares([]);
        setTotalCount(0);
        setNextCursor(null);
        const forbidden = listResult.error.code === "LIVE_FORBIDDEN";
        setLoadError({
          message: listResult.error.message,
          safeCode: listResult.error.safeCode,
          forbidden,
        });
        setConnectionStatus(listResult.error.code === "DATA_SOURCE_NOT_CONFIGURED" ? "disconnected" : "disconnected");
      } else {
        setShares(listResult.data.items);
        setTotalCount(listResult.data.totalCount);
        setNextCursor(listResult.data.nextCursor);
        setLoadError(null);
        lastSuccessAtRef.current = Date.now();
        setConnectionStatus("connected");
      }

      setSchedules(scheduleResult.ok ? scheduleResult.data : []);
      if (reminderResult.ok) {
        setReminderEnabledIds(
          new Set(reminderResult.data.filter((row) => row.enabled).map((row) => row.scheduleId)),
        );
      }
      setCategoryCounts(categoryResult.ok ? categoryResult.data : []);

      if (programResult.ok) {
        setCtaState(resolveCtaStateFromProgram(programResult.data));
      }
      setGoLiveAllowed(Boolean(preflightResult.ok && preflightResult.data.allowed));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [debouncedQuery, categoryFilter, languageFilter, followingOnly, sort, reloadToken]);

  useEffect(() => {
    let debounceTimer: number | null = null;
    const triggerReload = () => {
      setConnectionStatus((current) => (current === "disconnected" ? current : "reconnecting"));
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => setReloadToken((value) => value + 1), REALTIME_RELOAD_DEBOUNCE_MS);
    };
    const unsubscribe = publisherLiveNowService.subscribeToPublisherLiveNow(triggerReload);
    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!lastSuccessAtRef.current) return;
      if (Date.now() - lastSuccessAtRef.current > STALE_AFTER_MS && connectionStatus === "connected") {
        setConnectionStatus("stale");
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [connectionStatus]);

  const featured = useMemo(() => {
    const active = shares.filter((s) => s.status === "live" || s.status === "reconnecting");
    if (active.length === 0) return null;
    return [...active].sort((a, b) => b.viewerCount - a.viewerCount)[0] ?? null;
  }, [shares]);

  const followingLive = useMemo(
    () => shares.filter((s) => followedUserIds.includes(s.broadcasterUserId)),
    [shares, followedUserIds],
  );

  const justStarted = useMemo(() => shares.filter((s) => isJustStarted(s)), [shares]);

  const categoryBuckets = useMemo(() => {
    if (categoryCounts.length > 0) {
      return categoryCounts
        .map((row) => ({
          id: (["game", "chat", "education", "watch_together", "other"].includes(row.category)
            ? row.category
            : "other") as LiveScreenShareCategory,
          label: row.category.replace(/_/g, " "),
          liveCount: row.liveCount,
        }))
        .filter((b) => b.liveCount > 0);
    }
    return buildCategoryBuckets(shares);
  }, [categoryCounts, shares]);

  const ctaActions = useMemo(
    () => resolveLiveNowCtaActions(ctaState, { allowed: goLiveAllowed }),
    [ctaState, goLiveAllowed],
  );

  const hasFilters = Boolean(debouncedQuery || categoryFilter || languageFilter || followingOnly || sort !== "viewers");
  const countLabel = t("live.now.count", { count: String(totalCount) });
  const reload = () => setReloadToken((value) => value + 1);

  useEffect(() => {
    if (loading) return;
    if (announcedCountRef.current === totalCount) return;
    announcedCountRef.current = totalCount;
  }, [totalCount, loading]);

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
    if (share.status === "terminated" || share.status === "ended") {
      onNotice(share.status === "terminated" ? "This stream was removed." : "This stream has ended.", share.status === "terminated" ? "error" : "info");
      return;
    }
    saveDiscoveryRestoreState({
      query,
      filter: followingOnly ? "following" : "all",
      categoryFilter,
      featuredOverrideId: featured?.id ?? null,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    });
    onJoinLive(share);
  };

  const reportShare = async (share: LiveScreenShareSummary) => {
    const { liveScreenShareService } = await import("../../services/live/liveScreenShareService");
    const result = await liveScreenShareService.reportLiveShare(share.id, "Reported from Live Now.");
    onNotice(result.ok ? "Report sent." : result.error.message, result.ok ? "success" : "error");
  };

  const hideCommunity = async (communityId: string) => {
    const { liveScreenShareService } = await import("../../services/live/liveScreenShareService");
    const result = await liveScreenShareService.hideLiveCommunity(communityId);
    if (result.ok) {
      setShares((current) => current.filter((share) => share.communityId !== communityId));
      setTotalCount((c) => Math.max(0, c - 1));
      onNotice("Hidden from Live Now.", "success");
    } else {
      onNotice(result.error.message, "error");
    }
  };

  const toggleScheduleReminder = async (scheduleId: string) => {
    if (reminderBusyId) return;
    const nextEnabled = !reminderEnabledIds.has(scheduleId);
    setReminderBusyId(scheduleId);
    const result = await publisherLiveNowService.setScheduleReminder(scheduleId, nextEnabled);
    setReminderBusyId(null);
    if (!result.ok) {
      onNotice(result.error.message, "error");
      return;
    }
    setReminderEnabledIds((current) => {
      const next = new Set(current);
      if (result.data.enabled) next.add(scheduleId);
      else next.delete(scheduleId);
      return next;
    });
    onNotice(
      result.data.enabled ? t("live.now.schedule.remindOn") : t("live.now.schedule.remindOff"),
      "success",
    );
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await publisherLiveNowService.listPublisherLiveNow({
      limit: LIST_LIMIT,
      cursor: nextCursor,
      search: debouncedQuery || null,
      category: categoryFilter,
      language: languageFilter || null,
      followingOnly,
      sort,
    });
    if (result.ok) {
      setShares((current) => {
        const seen = new Set(current.map((s) => s.id));
        return [...current, ...result.data.items.filter((s) => !seen.has(s.id))];
      });
      setNextCursor(result.data.nextCursor);
      setTotalCount(result.data.totalCount);
    }
    setLoadingMore(false);
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter(null);
    setLanguageFilter("");
    setFollowingOnly(false);
    setSort("viewers");
  };

  const handleCta = (action: LiveNowCtaAction) => {
    if (action.kind === "go_live") {
      if (!action.enabled || !onOpenGoLive) return;
      onOpenGoLive();
      return;
    }
    if (action.kind !== "link") return;
    if (action.key === "dashboard") {
      onOpenPublisherDashboard?.();
      return;
    }
    onOpenPublisherApply?.();
  };

  const cardActions = {
    onJoin: joinShare,
    onOpenCommunity,
    onOpenProfile,
    onReport: reportShare,
    onHideCommunity: hideCommunity,
  } as const;

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const share of shares) {
      if (share.languageCode) set.add(share.languageCode);
    }
    return [...set].sort();
  }, [shares]);

  const discover = onDiscoverPublishers ?? onFindFriends;

  const renderCards = (items: readonly PublisherLiveNowSummary[], className = "live-section__cards") => (
    <div className={className}>
      {items.map((share) => (
        <LiveShareCard
          key={share.id}
          share={share}
          following={followedUserIds.includes(share.broadcasterUserId)}
          onToggleFollow={onToggleFollow}
          {...cardActions}
        />
      ))}
    </div>
  );

  return (
    <main className="live-workspace" role="main" aria-label={t("live.now.title")} aria-labelledby="live-workspace-title">
      <header className="live-workspace__header">
        <div className="live-workspace__intro">
          <div className="live-workspace__title-row">
            <span className="live-workspace__mark" aria-hidden="true">
              <span className="live-workspace__mark-ring" />
              <AppIcon name="live" size="lg" />
            </span>
            <div className="live-workspace__titles">
              <p className="live-workspace__eyebrow">
                <span className="live-workspace__eyebrow-dot" aria-hidden="true" />
                <span aria-live="off">{countLabel}</span>
              </p>
              <h1 id="live-workspace-title">{t("live.now.title")}</h1>
            </div>
          </div>
          <p className="live-workspace__lede">{t("live.now.subtitle")}</p>
        </div>
        <div className="live-workspace__actions">
          <span
            className={`live-workspace__conn live-workspace__conn--${connectionStatus}`}
            role="status"
            aria-label={t(`live.now.connection.${connectionStatus}`)}
            title={t(`live.now.connection.${connectionStatus}`)}
          >
            <span className="live-workspace__conn-dot" aria-hidden="true" />
            <span className="live-workspace__conn-label">{t(`live.now.connection.${connectionStatus}`)}</span>
          </span>

          {ctaActions.map((action, index) => {
            if (action.kind === "account_message") {
              return (
                <p key={`msg-${index}`} className="live-workspace__cta-message" role="status">
                  {ctaLabel(action)}
                </p>
              );
            }
            if (action.kind === "status_chip") {
              return (
                <span key={`chip-${index}`} className="live-workspace__status-chip" role="status">
                  {ctaLabel(action)}
                </span>
              );
            }
            const disabled = action.kind === "go_live" && !action.enabled;
            return (
              <button
                key={`cta-${index}`}
                type="button"
                className={`live-workspace__refresh${action.kind === "go_live" ? " live-workspace__refresh--primary" : ""}`}
                onClick={() => handleCta(action)}
                disabled={disabled}
                aria-disabled={disabled}
                aria-label={ctaLabel(action)}
              >
                <AppIcon name={action.kind === "go_live" ? "live" : action.kind === "link" && action.key === "dashboard" ? "settings" : "users"} size="sm" aria-hidden="true" />
                <span>{ctaLabel(action)}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`live-workspace__refresh${loading ? " live-workspace__refresh--busy" : ""}`}
            onClick={reload}
            disabled={loading}
            aria-label={loading ? t("live.now.refreshing") : t("live.now.refresh")}
          >
            <AppIcon name="refresh" size="sm" aria-hidden="true" />
            <span>{loading ? t("live.now.refreshing") : t("live.now.refresh")}</span>
          </button>
        </div>
      </header>

      <div className="live-workspace__toolbar" role="search">
        <label className="live-workspace__search">
          <span className="live-workspace__search-icon" aria-hidden="true">
            <AppIcon name="search" size="sm" />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("live.now.searchPlaceholder")}
            aria-label={t("live.now.searchAria")}
          />
          {query ? (
            <button type="button" className="live-workspace__search-clear" aria-label={t("live.now.clearSearch")} onClick={() => setQuery("")}>
              <AppIcon name="close" size="xs" />
            </button>
          ) : null}
        </label>
        <div className="live-workspace__filters" role="group" aria-label="Live Now filters">
          <button
            type="button"
            className={`live-workspace__filter-chip${followingOnly ? " is-active" : ""}`}
            aria-pressed={followingOnly}
            onClick={() => setFollowingOnly((v) => !v)}
          >
            {t("live.now.filter.following")}
          </button>
          <button
            type="button"
            className={`live-workspace__filter-chip${sort === "newest" ? " is-active" : ""}`}
            aria-pressed={sort === "newest"}
            onClick={() => setSort((s) => (s === "newest" ? "viewers" : "newest"))}
          >
            {t("live.now.filter.newest")}
          </button>
          <button
            type="button"
            className={`live-workspace__filter-chip${sort === "viewers" && !followingOnly ? " is-active" : ""}`}
            aria-pressed={sort === "viewers"}
            onClick={() => setSort("viewers")}
          >
            {t("live.now.filter.viewers")}
          </button>
          {languages.length > 0 ? (
            <label className="live-workspace__filter-select">
              <span className="sr-only">{t("live.now.filter.language")}</span>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                aria-label={t("live.now.filter.language")}
              >
                <option value="">{t("live.now.filter.all")}</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="live-workspace__body live-workspace__body--discovery" ref={scrollRef}>
        {loadError?.forbidden ? (
          <div className="live-error" role="alert">
            <strong>{t("live.now.forbidden.title")}</strong>
            <p>{t("live.now.forbidden.body")}</p>
            <p className="live-error__code">{loadError.safeCode}</p>
          </div>
        ) : loadError ? (
          <div className="live-error" role="alert">
            <strong>{t("live.now.error.title")}</strong>
            <p>{t("live.now.error.body")}</p>
            <p className="live-error__code">{loadError.safeCode}</p>
            <button type="button" className="live-error__retry" onClick={reload}>
              {t("live.now.error.retry")}
            </button>
          </div>
        ) : loading && shares.length === 0 ? (
          <div className="live-loading live-loading--skeleton" role="status" aria-busy="true">
            <div className="live-skeleton-card" />
            <div className="live-skeleton-card" />
            <div className="live-skeleton-card" />
            <span className="sr-only">{t("live.now.loading")}</span>
          </div>
        ) : shares.length === 0 ? (
          <div className={`live-empty live-empty--compact${hasFilters ? " live-empty--filtered" : ""}`} role="status">
            <strong>{hasFilters ? t("live.now.empty.filteredTitle") : t("live.now.empty.title")}</strong>
            <p>{hasFilters ? t("live.now.empty.filteredBody") : t("live.now.empty.body")}</p>
            <div className="live-empty__actions">
              {hasFilters ? (
                <button type="button" className="live-empty__cta live-empty__cta--ghost" onClick={clearFilters}>
                  {t("live.now.empty.clearFilters")}
                </button>
              ) : null}
              {discover ? (
                <button type="button" className="live-empty__cta" onClick={discover}>
                  {t("live.now.empty.ctaDiscover")}
                </button>
              ) : null}
            </div>
            {!hasFilters ? (
              <div className="live-empty__secondary">
                {schedules.length > 0 ? (
                  <section aria-labelledby="empty-upcoming">
                    <h2 id="empty-upcoming">{t("live.now.section.secondaryUpcoming")}</h2>
                    <ul className="live-schedule-list">
                      {schedules.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          <strong>{item.title}</strong>
                          <span>{item.publisherDisplayName}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {categoryBuckets.length > 0 ? (
                  <section aria-labelledby="empty-cats">
                    <h2 id="empty-cats">{t("live.now.section.secondaryCategories")}</h2>
                    <LiveCategoryRail buckets={categoryBuckets} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {featured ? (
              <LiveDiscoverySection id="featured" title={t("live.now.featured")} icon="live">
                <LiveFeaturedCard
                  share={featured}
                  {...cardActions}
                  following={followedUserIds.includes(featured.broadcasterUserId)}
                  onToggleFollow={onToggleFollow}
                />
              </LiveDiscoverySection>
            ) : null}

            {followingLive.length > 0 ? (
              <LiveDiscoverySection id="following-live" title={t("live.now.followingLive")} icon="users" hiddenWhenEmpty>
                {renderCards(followingLive)}
              </LiveDiscoverySection>
            ) : null}

            <LiveDiscoverySection id="all-live" title={t("live.now.allLive")} icon="live">
              {renderCards(shares, "live-grid live-grid--discovery")}
              {nextCursor ? (
                <button type="button" className="live-workspace__load-more" onClick={() => void loadMore()} disabled={loadingMore}>
                  {t("live.now.loadMore")}
                </button>
              ) : null}
            </LiveDiscoverySection>

            {justStarted.length > 0 && sort !== "newest" ? (
              <LiveDiscoverySection id="just-started" title={t("live.now.filter.newest")} icon="calendar" variant="fresh" hiddenWhenEmpty>
                {renderCards(justStarted, "live-section__cards live-section__cards--fresh")}
              </LiveDiscoverySection>
            ) : null}

            {schedules.length > 0 ? (
              <LiveDiscoverySection id="upcoming" title={t("live.now.upcoming")} icon="calendar">
                <ul className="live-schedule-list">
                  {schedules.map((item) => (
                    <li key={item.id} className="live-schedule-card">
                      <div className="live-schedule-card__body">
                        <strong>{item.title}</strong>
                        <span className="live-schedule-card__publisher">
                          {item.publisherDisplayName}
                          {item.publisherBadgeType ? (
                            <span className="live-badge-verified" title={item.publisherBadgeType}>
                              {item.publisherBadgeType.includes("creator") ? t("live.now.badge.creator") : t("live.now.badge.publisher")}
                            </span>
                          ) : null}
                        </span>
                        <span>
                          {t("live.now.schedule.starts", {
                            time: new Date(item.scheduledStartAt).toLocaleString(localizationService.getLanguage()),
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`live-schedule-card__remind${reminderEnabledIds.has(item.id) ? " is-active" : ""}`}
                        disabled={reminderBusyId === item.id}
                        onClick={() => void toggleScheduleReminder(item.id)}
                        aria-pressed={reminderEnabledIds.has(item.id)}
                        aria-label={`${
                          reminderEnabledIds.has(item.id)
                            ? t("live.now.schedule.remindOff")
                            : t("live.now.schedule.remindOn")
                        }: ${item.title}`}
                      >
                        {reminderEnabledIds.has(item.id)
                          ? t("live.now.schedule.remindOn")
                          : t("live.now.schedule.remind")}
                      </button>
                    </li>
                  ))}
                </ul>
              </LiveDiscoverySection>
            ) : null}

            {categoryBuckets.length > 0 ? (
              <LiveDiscoverySection id="categories" title={t("live.now.categories")} icon="hash">
                <LiveCategoryRail buckets={categoryBuckets} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
              </LiveDiscoverySection>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

// Keep helper export used by older tests / imports that referenced broadcaster search.
export { broadcasterLabel };
