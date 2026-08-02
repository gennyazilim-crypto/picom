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
    <section className="feed-live-now" aria-label={localizationService.translate("feed.live.bandLabel")}>
      <div className="feed-live-now__heading">
        <div>
          <p className="eyebrow">{localizationService.translate("feed.live.eyebrow")}</p>
          <h1>{localizationService.translate("feed.live.title")}</h1>
          <span>{localizationService.translate("feed.live.subtitle")}</span>
        </div>
        {state === "ready" ? <strong>{localizationService.translate("feed.live.count", { count: String(items.length) })}</strong> : null}
      </div>

      {state === "loading" ? (
        <div className="feed-live-now__status" role="status" aria-live="polite">
          {localizationService.translate("feed.loading")}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="feed-live-now__status feed-live-now__status--error" role="alert">
          <strong>{localizationService.translate("feed.error.title")}</strong>
          <span>{localizationService.translate("feed.error.body")}</span>
          <button type="button" className="feed-live-now__retry" onClick={() => { void load(); }}>
            {localizationService.translate("feed.retry")}
          </button>
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="feed-live-now__status" role="status">
          <AppIcon name="voice" size="md" />
          <div>
            <strong>{localizationService.translate("feed.live.emptyTitle")}</strong>
            <small>{localizationService.translate("feed.live.emptyBody")}</small>
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
                  <span className="feed-live-now__topline">
                    <LiveStatusBadge status={share.status} />
                    <span className="feed-live-now__viewers">
                      <AppIcon name="users" size="xs" /> {formatViewerCount(share.viewerCount || share.participantCount)}
                    </span>
                  </span>
                  <span className="feed-live-now__identity">
                    <UserAvatar userId={share.broadcasterUserId} displayName={label} size={34} />
                    <span>
                      <strong>{label}</strong>
                      <small>{share.title || categoryLabel(share.category)}</small>
                    </span>
                  </span>
                  <span className="feed-live-now__meta">
                    <strong>{share.communityName || localizationService.translate("feed.live.communityFallback")}</strong>
                    <small>{categoryLabel(share.category)} · {formatLiveDuration(share.startedAt)}</small>
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
