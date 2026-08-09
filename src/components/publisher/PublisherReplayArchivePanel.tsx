import { useEffect, useId, useState } from "react";
import { localizationService } from "../../services/localizationService";
import { featureFlagService } from "../../services/featureFlagService";
import { translatePublisherMedia } from "../../services/localization/publisherMediaCatalog";
import {
  publisherRecordingService,
  type PublisherReplayListItem,
} from "../../services/live/publisherRecordingService";

function t(key: string): string {
  return translatePublisherMedia(key, localizationService.getLanguage());
}

export function PublisherReplayArchivePanel() {
  const enabled = featureFlagService.isEnabled("enableLiveReplays");
  const clipsEnabled = featureFlagService.isEnabled("enableLiveClips");
  const [items, setItems] = useState<ReadonlyArray<PublisherReplayListItem>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipStart, setClipStart] = useState("0");
  const [clipEnd, setClipEnd] = useState("10000");
  const [clipTitle, setClipTitle] = useState("Clip");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    void publisherRecordingService.listReplays({ limit: 40 }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setItems([]);
        return;
      }
      setError(null);
      setItems(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) {
    return (
      <section aria-labelledby={headingId}>
        <h2 id={headingId}>{t("media.archive")}</h2>
        <p>{t("media.recordingUnavailable")}</p>
      </section>
    );
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <section aria-labelledby={headingId} className="publisher-program-panel">
      <header className="publisher-program-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 id={headingId}>{t("media.archive")}</h2>
          <p>{t("media.replays")}</p>
        </div>
      </header>

      {loading ? <p>{t("media.processing")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && items.length === 0 ? <p>{t("media.mediaUnavailable")}</p> : null}

      {items.length > 0 ? (
        <table>
          <caption>{t("media.replays")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("media.replay")}</th>
              <th scope="col">{t("media.ready")}</th>
              <th scope="col">{t("media.private")}</th>
              <th scope="col">{t("media.clipDuration")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <button type="button" onClick={() => setSelectedId(item.id)}>
                    {item.title || item.id}
                  </button>
                </td>
                <td>{item.status}</td>
                <td>{item.visibility}</td>
                <td>{item.durationMs == null ? "—" : `${Math.round(item.durationMs / 1000)}s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {selected ? (
        <div style={{ marginTop: 24 }}>
          <h3>{selected.title}</h3>
          <p>
            {selected.status} · {selected.visibility}
            {selected.failureCode ? ` · ${selected.failureCode}` : ""}
          </p>
          <div role="group" aria-label={t("media.replay")}>
            <button
              type="button"
              onClick={() => {
                void publisherRecordingService.getPlaybackUrl(selected.id).then((result) => {
                  if (!result.ok) {
                    setError(result.message);
                    setPlaybackUrl(null);
                    return;
                  }
                  setPlaybackUrl(result.data.url);
                });
              }}
            >
              {t("media.replay")}
            </button>
            <button
              type="button"
              onClick={() => {
                void publisherRecordingService.updateReplay({ replayId: selected.id, action: "publish", visibility: "PUBLIC" });
              }}
            >
              {t("media.publishReplay")}
            </button>
            <button
              type="button"
              onClick={() => {
                void publisherRecordingService.updateReplay({ replayId: selected.id, action: "archive" });
              }}
            >
              {t("media.archiveReplay")}
            </button>
            <button
              type="button"
              onClick={() => {
                void publisherRecordingService.updateReplay({ replayId: selected.id, action: "delete" });
              }}
            >
              {t("media.deleteReplay")}
            </button>
          </div>

          {playbackUrl ? (
            <video
              key={playbackUrl}
              controls
              preload="metadata"
              src={playbackUrl}
              style={{ width: "100%", maxWidth: 720, marginTop: 12 }}
              aria-label={t("media.replay")}
            >
              {t("media.playbackError")}
            </video>
          ) : null}

          {clipsEnabled ? (
            <form
              style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                const startMs = Number(clipStart);
                const endMs = Number(clipEnd);
                void publisherRecordingService
                  .createClip({
                    replayId: selected.id,
                    startMs,
                    endMs,
                    title: clipTitle,
                    visibility: "PRIVATE",
                  })
                  .then((result) => {
                    if (!result.ok) setError(result.message);
                  });
              }}
            >
              <h4>{t("media.createClip")}</h4>
              <label>
                {t("media.clipStart")}
                <input type="number" min={0} value={clipStart} onChange={(e) => setClipStart(e.target.value)} required />
              </label>
              <label>
                {t("media.clipEnd")}
                <input type="number" min={1} value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} required />
              </label>
              <label>
                {t("media.replay")}
                <input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} maxLength={120} required />
              </label>
              <button type="submit">{t("media.createClip")}</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
