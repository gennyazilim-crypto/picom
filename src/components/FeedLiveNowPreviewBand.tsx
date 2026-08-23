import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveScreenShareSummary } from "../types/liveScreenShare";
import { liveScreenShareService } from "../services/live/liveScreenShareService";
import { useTranslation, type TFunction } from "../i18n";
import { AppIcon } from "./AppIcon";
import { UserAvatar } from "./UserAvatar";
import { formatLiveDuration, formatViewerCount, broadcasterLabel } from "./live/LiveShareCard";
import "./FeedLiveNowPreviewBand.css";

type FeedLiveNowPreviewBandProps = {
  onOpenLiveSession: (sessionId: string) => void;
};

type BandState = "loading" | "ready" | "empty" | "error";

function categoryLabel(t: TFunction, category: LiveScreenShareSummary["category"]): string {
  switch (category) {
    case "game": return t("live.category.game");
    case "chat": return t("live.category.chat");
    case "education": return t("live.category.education");
    case "watch_together": return t("live.category.watchTogether");
    default: return t("live.category.other");
  }
}

export function FeedLiveNowPreviewBand({ onOpenLiveSession }: FeedLiveNowPreviewBandProps) {
  const { t } = useTranslation("feed");
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
    grid.scrollBy({ left: direction * Math.max(220, Math.round(grid.clientWidth * 0.7)), behavior: "smooth" });
  };

  return (
    <section className="feed-live-now" data-state={state} aria-label={t("live.bandLabel")}>
      <header className="feed-live-now__heading">
        <h2 className="feed-live-now__title">
          <span className="feed-live-now__pulse" aria-hidden="true" />
          {t("live.title")}
          {state === "ready" ? (
            <span className="feed-live-now__count">{items.length}</span>
          ) : null}
        </h2>
        {state === "ready" && items.length > 2 ? (
          <div className="feed-live-now__nav-group">
            <button type="button" className="feed-live-now__nav previous" aria-label={t("live.scrollLeft")} onClick={() => scroll(-1)}>
              <AppIcon name="chevronRight" size="sm" />
            </button>
            <button type="button" className="feed-live-now__nav next" aria-label={t("live.scrollRight")} onClick={() => scroll(1)}>
              <AppIcon name="chevronRight" size="sm" />
            </button>
          </div>
        ) : null}
      </header>

      {state === "loading" ? (
        <div className="feed-live-now__status feed-live-now__status--loading" role="status" aria-live="polite">
          <span className="feed-live-now__skeleton" aria-hidden="true" />
          <span className="visually-hidden">{t("loading")}</span>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="feed-live-now__status feed-live-now__status--error" role="alert">
          <div className="feed-live-now__status-copy">
            <strong>{t("error.title")}</strong>
            <span>{t("error.body")}</span>
          </div>
          <button type="button" className="feed-live-now__retry" onClick={() => { void load(); }}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="feed-live-now__status feed-live-now__status--empty" role="status">
          <div className="feed-live-now__status-copy">
            <strong>{t("live.emptyTitle")}</strong>
            <span>{t("live.emptyBody")}</span>
          </div>
        </div>
      ) : null}

      {state === "ready" ? (
        <div ref={gridRef} className="feed-live-now__grid">
          {items.map((share) => {
            const label = broadcasterLabel(share);
            const detail = share.title || categoryLabel(t, share.category);
            const community = share.communityName || t("live.communityFallback");
            return (
              <button
                key={share.id}
                type="button"
                className="feed-live-now__card"
                aria-label={t("live.openAria", { name: label, title: share.title })}
                onClick={() => onOpenLiveSession(share.id)}
              >
                <span className="feed-live-now__thumb" aria-hidden="true">
                  <span className="feed-live-now__thumb-fallback" />
                  <span className="feed-live-now__live-chip">LIVE</span>
                </span>
                <span className="feed-live-now__info">
                  <span className="feed-live-now__info-top">
                    <UserAvatar userId={share.broadcasterUserId} displayName={label} size={22} />
                    <strong className="feed-live-now__name">{label}</strong>
                  </span>
                  <span className="feed-live-now__detail">{detail}</span>
                  <span className="feed-live-now__meta-line">
                    <span>{community}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatViewerCount(share.viewerCount || share.participantCount)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatLiveDuration(share.startedAt)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
