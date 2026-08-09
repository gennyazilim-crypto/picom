import { useEffect, useId, useState } from "react";
import { localizationService } from "../../services/localizationService";
import { featureFlagService } from "../../services/featureFlagService";
import { getUiLanguageBcp47 } from "../../services/localization/uiLanguages";
import { translatePublisherAnalytics } from "../../services/localization/publisherAnalyticsCatalog";
import {
  formatWatchDuration,
  publisherAnalyticsService,
  type PublisherAnalyticsOverview,
} from "../../services/live/publisherAnalyticsService";

function t(key: string): string {
  return translatePublisherAnalytics(key, localizationService.getLanguage());
}

export function PublisherAnalyticsPanel() {
  const enabled = featureFlagService.isEnabled("enablePublisherAnalytics");
  const [rangeDays, setRangeDays] = useState(30);
  const [overview, setOverview] = useState<PublisherAnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const headingId = useId();
  const locale = getUiLanguageBcp47(localizationService.getLanguage());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    void publisherAnalyticsService.getOverview(rangeDays).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setOverview(null);
        return;
      }
      setError(null);
      setOverview(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, rangeDays]);

  if (!enabled) {
    return (
      <section aria-labelledby={headingId}>
        <h2 id={headingId}>{t("analytics.title")}</h2>
        <p>{t("analytics.disabled")}</p>
      </section>
    );
  }

  const empty = overview && overview.streamCount === 0;

  return (
    <section aria-labelledby={headingId} className="publisher-program-panel">
      <header className="publisher-program-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 id={headingId}>{t("analytics.title")}</h2>
          <p>{t("analytics.overview")}</p>
        </div>
        <div role="group" aria-label={t("analytics.overview")}>
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={rangeDays === days}
              onClick={() => setRangeDays(days)}
              style={{ marginLeft: 8 }}
            >
              {t(days === 7 ? "analytics.range7" : days === 30 ? "analytics.range30" : "analytics.range90")}
            </button>
          ))}
        </div>
      </header>

      {loading ? <p>{t("analytics.analyticsProcessing")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {empty ? <p>{t("analytics.noAnalyticsData")}</p> : null}

      {overview && !empty ? (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}
            aria-label={t("analytics.overview")}
          >
            <MetricCard label={t("analytics.streamCount")} value={String(overview.streamCount)} />
            <MetricCard label={t("analytics.uniqueViewers")} value={String(overview.uniqueViewers)} />
            <MetricCard label={t("analytics.viewerSessions")} value={String(overview.viewerSessions)} />
            <MetricCard label={t("analytics.peakConcurrent")} value={String(overview.peakConcurrent)} />
            <MetricCard
              label={t("analytics.watchTime")}
              value={formatWatchDuration(overview.totalWatchSeconds, locale)}
            />
            <MetricCard
              label={t("analytics.averageWatchTime")}
              value={formatWatchDuration(overview.avgWatchSeconds, locale)}
            />
            <MetricCard label={t("analytics.followersGained")} value={String(overview.followersGained)} />
            <MetricCard label={t("analytics.chatMessages")} value={String(overview.chatMessages)} />
            <MetricCard label={t("analytics.notificationConversion")} value={String(overview.notificationJoins)} />
          </div>

          <h3 style={{ marginTop: 24 }}>{t("analytics.recentStreams")}</h3>
          <div className="publisher-program-table-wrap">
            <table className="publisher-program-table">
              <caption className="sr-only">{t("analytics.streamPerformance")}</caption>
              <thead>
                <tr>
                  <th scope="col">Stream</th>
                  <th scope="col">{t("analytics.uniqueViewers")}</th>
                  <th scope="col">{t("analytics.peakConcurrent")}</th>
                  <th scope="col">{t("analytics.watchTime")}</th>
                  <th scope="col">{t("analytics.chatMessages")}</th>
                  <th scope="col">{t("analytics.followersGained")}</th>
                  <th scope="col">{t("analytics.finalized")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.streams.map((stream) => (
                  <tr key={stream.streamId}>
                    <td>
                      <code>{stream.streamId.slice(0, 8)}</code>
                      <div style={{ opacity: 0.7, fontSize: "0.85em" }}>
                        {stream.startedAt ? new Date(stream.startedAt).toLocaleString(locale) : "—"}
                      </div>
                    </td>
                    <td>{stream.uniqueViewers}</td>
                    <td>{stream.peakConcurrent}</td>
                    <td>{formatWatchDuration(stream.totalWatchSeconds, locale)}</td>
                    <td>{stream.chatMessages}</td>
                    <td>{stream.followersGained}</td>
                    <td>{stream.finalized ? t("analytics.finalized") : t("analytics.live")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 600 }} aria-label={`${label}: ${value}`}>
        {value}
      </div>
    </article>
  );
}
