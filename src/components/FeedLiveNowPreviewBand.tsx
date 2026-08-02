import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveScreenShareSummary } from "../types/liveScreenShare";
import { liveScreenShareService } from "../services/live/liveScreenShareService";
import { localizationService } from "../services/localizationService";
import { AppIcon } from "./AppIcon";
import { UserAvatar } from "./UserAvatar";
import { formatLiveDuration, formatViewerCount, LiveStatusBadge, broadcasterLabel } from "./live/LiveShareCard";
import "./FeedLiveNowPreviewBand.css";

type FeedLiveNowPreviewBandProps = {
  onOpenLiveSession: (sessionId: string) => void;
};

type BandState = "loading" | "ready" | "empty" | "error";

function categoryLabel(category: LiveScreenShareSummary["category"]): string {
  switch (category) {
    case "game": return localizationService.translate("feed.live.category.game");
    case "chat": return localizationService.translate("feed.live.category.chat");
    case "education": return localizationService.translate("feed.live.category.education");
    case "watch_together": return localizationService.translate("feed.live.category.watchTogether");
    default: return localizationService.translate("feed.live.category.other");
  }
}

export function FeedLiveNowPreviewBand({ onOpenLiveSession }: FeedLiveNowPreviewBandProps) {
  const [items, setItems] = useState<readonly LiveScreenShareSummary[]>([]);
  const [state, setState] = useState<BandState>("loading");
  const requestIdRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((current) => (current === "ready" && items.length ? "ready" : "loading"));
    const result = await liveScreenShareService.listVisibleLiveShares({
      filter: "all",
      sort: "recommended",
      limit: 12,
    });
    if (requestId !== requestIdRef.current) return;
    if (!result.ok) {
      setItems([]);
      setState("error");
      return;
    }
    const liveOnly = result.data.items.filter((item) => item.status === "live" || item.status === "reconnecting");
    const deduped: LiveScreenShareSummary[] = [];
    const seen = new Set<string>();
    for (const item of liveOnly) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      deduped.push(item);
    }
    setItems(deduped);
    setState(deduped.length ? "ready" : "empty");
  }, [items.length]);

  useEffect(() => {
    void load();
    const unsubscribe = liveScreenShareService.subscribeToVisibleLiveShares(() => {
      void load();
    });
    return () => {
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, [load]);

  const scroll = (direction: -1 | 1) => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.scrollBy({ left: direction * Math.max(240, Math.round(grid.clientWidth * 0.72)), behavior: "smooth" });
  };

  return (
    <section className="feed-live-now" data-state={state} aria-label={localizationService.translate("feed.live.bandLabel")}>
      <header className="feed-live-now__heading">
        <div className="feed-live-now__title-block">
          <div className="feed-live-now__badge" aria-hidden="true">
            <span className="feed-live-now__pulse" />
            <span>{localizationService.translate("feed.live.eyebrow")}</span>
          </div>
          <h2 className="feed-live-now__title">{localizationService.translate("feed.live.title")}</h2>
          <p className="feed-live-now__subtitle">{localizationService.translate("feed.live.subtitle")}</p>
        </div>
        {state === "ready" ? (
          <p className="feed-live-now__count">{localizationService.translate("feed.live.count", { count: String(items.length) })}</p>
        ) : null}
      </header>

      {state === "loading" ? (
        <div className="feed-live-now__status feed-live-now__status--loading" role="status" aria-live="polite">
          <span className="feed-live-now__skeleton" aria-hidden="true" />
          <span className="feed-live-now__skeleton feed-live-now__skeleton--short" aria-hidden="true" />
          <span className="visually-hidden">{localizationService.translate("feed.loading")}</span>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="feed-live-now__status feed-live-now__status--error" role="alert">
          <div className="feed-live-now__status-copy">
            <strong>{localizationService.translate("feed.error.title")}</strong>
            <span>{localizationService.translate("feed.error.body")}</span>
          </div>
          <button type="button" className="feed-live-now__retry" onClick={() => { void load(); }}>
            {localizationService.translate("feed.retry")}
          </button>
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="feed-live-now__status feed-live-now__status--empty" role="status">
          <div className="feed-live-now__empty-icon" aria-hidden="true">
            <AppIcon name="voice" size="md" />
          </div>
          <div className="feed-live-now__status-copy">
            <strong>{localizationService.translate("feed.live.emptyTitle")}</strong>
            <span>{localizationService.translate("feed.live.emptyBody")}</span>
          </div>
        </div>
      ) : null}

      {state === "ready" ? (
        <div className="feed-live-now__grid-shell">
          <button type="button" className="feed-live-now__nav previous" aria-label={localizationService.translate("feed.live.scrollLeft")} onClick={() => scroll(-1)}>
            <AppIcon name="chevronRight" size="sm" />
          </button>
          <div ref={gridRef} className="feed-live-now__grid">
            {items.map((share) => {
              const label = broadcasterLabel(share);
              return (
                <button
                  key={share.id}
                  type="button"
                  className="feed-live-now__card"
                  aria-label={localizationService.translate("feed.live.openAria", { name: label, title: share.title })}
                  onClick={() => onOpenLiveSession(share.id)}
                >
                  <span className="feed-live-now__media" aria-hidden="true">
                    <span className="feed-live-now__media-fallback" />
                    <span className="feed-live-now__media-scrim" />
                    <span className="feed-live-now__media-live">
                      <LiveStatusBadge status={share.status} />
                    </span>
                  </span>
                  <span className="feed-live-now__topline">
                    <span className="feed-live-now__viewers">
                      <AppIcon name="users" size="xs" /> {formatViewerCount(share.viewerCount || share.participantCount)}
                    </span>
                    <small>{formatLiveDuration(share.startedAt)}</small>
                  </span>
                  <span className="feed-live-now__identity">
                    <UserAvatar userId={share.broadcasterUserId} displayName={label} size={34} />
                    <span className="feed-live-now__identity-text">
                      <strong>{label}</strong>
                      <small>{share.title || categoryLabel(share.category)}</small>
                    </span>
                  </span>
                  <span className="feed-live-now__meta">
                    <strong>{share.communityName || localizationService.translate("feed.live.communityFallback")}</strong>
                    <small>{categoryLabel(share.category)}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="feed-live-now__nav next" aria-label={localizationService.translate("feed.live.scrollRight")} onClick={() => scroll(1)}>
            <AppIcon name="chevronRight" size="sm" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
