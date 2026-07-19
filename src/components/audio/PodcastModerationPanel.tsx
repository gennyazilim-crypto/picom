import { useCallback, useEffect, useMemo, useState } from "react";
import { podcastModerationService } from "../../services/audio/podcastModerationService";
import { dateTimeService } from "../../services/dateTimeService";
import type { PodcastEpisode } from "../../types/audio";
import type { ReportRecord, ReportStatus } from "../../types/reports";
import { AppIcon } from "../AppIcon";

type Intent =
  | { kind: "comment"; targetId: string; label: string; reportId?: string }
  | { kind: "episode"; targetId: string; label: string; action: "unpublish" | "archive"; reportId?: string };

type Props = {
  communityId: string;
  episodes: readonly PodcastEpisode[];
  canModerateComments: boolean;
  canModerateEpisodes: boolean;
  onEpisodeChanged: (episode?: PodcastEpisode) => void;
};

function formatReportStatus(status: ReportStatus) {
  return status.replace("_", " ");
}

function formatReportReason(reason: string) {
  return reason.replace("_", " ");
}

function reportStatusTone(status: ReportStatus) {
  if (status === "action_taken") return "success";
  if (status === "dismissed") return "muted";
  if (status === "reviewed") return "reviewed";
  return "open";
}

export function PodcastModerationPanel({
  communityId,
  episodes,
  canModerateComments,
  canModerateEpisodes,
  onEpisodeChanged,
}: Props) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [reason, setReason] = useState("");
  const canModerate = canModerateComments || canModerateEpisodes;
  const publishedEpisodes = useMemo(() => episodes.filter((episode) => episode.status === "published"), [episodes]);

  const openReports = useMemo(() => reports.filter((report) => report.status === "open").length, [reports]);
  const resolvedReports = useMemo(
    () => reports.filter((report) => report.status === "action_taken" || report.status === "dismissed").length,
    [reports],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await podcastModerationService.listReports(communityId, { canModerateComments, canModerateEpisodes });
    setLoading(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setReports([...result.data]);
  }, [canModerateComments, canModerateEpisodes, communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateReport = async (reportId: string, status: ReportStatus) => {
    setBusy(true);
    setNotice(null);
    const result = await podcastModerationService.updateReportStatus(reportId, status, canModerate);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setReports((current) => current.map((report) => (report.id === result.data.id ? result.data : report)));
    setNotice(`Report marked ${formatReportStatus(status)}.`);
  };

  const confirm = async () => {
    if (!intent || reason.trim().length < 10 || busy) return;
    setBusy(true);
    setNotice(null);
    if (intent.kind === "comment") {
      const result = await podcastModerationService.moderateComment(intent.targetId, reason);
      if (!result.ok) {
        setBusy(false);
        setNotice(result.error.message);
        return;
      }
    } else {
      const result = await podcastModerationService.moderateEpisode(intent.targetId, intent.action, reason);
      if (!result.ok) {
        setBusy(false);
        setNotice(result.error.message);
        return;
      }
      onEpisodeChanged(result.data);
    }
    if (intent.reportId) {
      const reportResult = await podcastModerationService.updateReportStatus(intent.reportId, "action_taken", canModerate);
      if (reportResult.ok) {
        setReports((current) => current.map((report) => (report.id === reportResult.data.id ? reportResult.data : report)));
      }
    }
    setBusy(false);
    setIntent(null);
    setReason("");
    setNotice("Moderation action completed and added to the audit log.");
  };

  const openIntent = (nextIntent: Intent) => {
    setIntent(nextIntent);
    setReason("");
  };

  if (!canModerate) {
    return (
      <div className="podcast-shell-empty">
        <AppIcon name="lock" size="xl" />
        <strong>Moderation access required</strong>
        <p>Your assigned community role does not include Podcast moderation.</p>
      </div>
    );
  }

  return (
    <section className="podcast-moderation-panel" aria-label="Podcast moderation">
      <header className="podcast-moderation-header">
        <div className="podcast-moderation-header-copy">
          <p className="podcast-moderation-eyebrow">Trust and safety</p>
          <h2>Podcast moderation</h2>
          <p>Review podcast reports and apply policy actions with an audit reason.</p>
        </div>
        <span className="podcast-moderation-header-icon" aria-hidden="true">
          <AppIcon name="lock" size="md" />
        </span>
      </header>

      <div className="podcast-moderation-metrics" aria-label="Moderation overview">
        <article>
          <strong>{loading ? "—" : openReports}</strong>
          <span>Open reports</span>
        </article>
        <article>
          <strong>{publishedEpisodes.length}</strong>
          <span>Published episodes</span>
        </article>
        <article>
          <strong>{loading ? "—" : resolvedReports}</strong>
          <span>Resolved</span>
        </article>
      </div>

      {notice ? (
        <div className="podcast-moderation-notice" role="status">
          <AppIcon name="bell" size="sm" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className={`podcast-moderation-grid ${canModerateEpisodes ? "" : "comments-only"}`}>
        <section className="podcast-moderation-card">
          <header className="podcast-moderation-card-header">
            <div>
              <p className="podcast-moderation-card-eyebrow">Report queue</p>
              <h3>Podcast reports</h3>
            </div>
            <button type="button" className="podcast-moderation-refresh" disabled={loading || busy} onClick={() => void load()}>
              <AppIcon name="inbox" size="sm" />
              Refresh
            </button>
          </header>

          {loading ? (
            <div className="podcast-moderation-state">
              <span className="podcast-moderation-state-icon" aria-hidden="true">
                <AppIcon name="inbox" size="lg" />
              </span>
              <strong>Loading authorized reports</strong>
              <span>Applying community role and privacy boundaries.</span>
            </div>
          ) : reports.length ? (
            <div className="podcast-report-list">
              {reports.map((report) => {
                const episode = report.targetType === "podcast_episode" ? episodes.find((item) => item.id === report.targetId) : undefined;
                const label =
                  episode?.title ??
                  (report.targetType === "podcast_comment"
                    ? `Podcast comment ${report.targetId.slice(0, 8)}`
                    : `Episode ${report.targetId.slice(0, 8)}`);

                return (
                  <article key={report.id} className="podcast-report-card">
                    <div className="podcast-report-card-copy">
                      <div className="podcast-report-card-meta">
                        <span className={`podcast-report-status is-${reportStatusTone(report.status)}`}>
                          {formatReportStatus(report.status)}
                        </span>
                        <span className="podcast-report-type">
                          {report.targetType === "podcast_comment" ? "Comment" : "Episode"}
                        </span>
                        <time dateTime={report.createdAt}>{dateTimeService.formatCompactDateTime(report.createdAt)}</time>
                      </div>
                      <strong>{label}</strong>
                      <p>
                        {formatReportReason(report.reason)}
                        {report.description ? ` — ${report.description}` : ""}
                      </p>
                    </div>
                    <footer className="podcast-report-card-actions">
                      {report.status === "open" ? (
                        <button type="button" disabled={busy} onClick={() => void updateReport(report.id, "reviewed")}>
                          Review
                        </button>
                      ) : null}
                      {report.targetType === "podcast_comment" && canModerateComments && report.status !== "action_taken" ? (
                        <button
                          type="button"
                          className="is-danger"
                          disabled={busy}
                          onClick={() => openIntent({ kind: "comment", targetId: report.targetId, label, reportId: report.id })}
                        >
                          <AppIcon name="trash" size="xs" />
                          Remove comment
                        </button>
                      ) : null}
                      {report.targetType === "podcast_episode" && canModerateEpisodes && report.status !== "action_taken" ? (
                        <button
                          type="button"
                          className="is-danger"
                          disabled={busy || !episode}
                          onClick={() =>
                            openIntent({ kind: "episode", targetId: report.targetId, label, action: "archive", reportId: report.id })
                          }
                        >
                          <AppIcon name="lock" size="xs" />
                          Archive episode
                        </button>
                      ) : null}
                      {report.status !== "dismissed" && report.status !== "action_taken" ? (
                        <button type="button" disabled={busy} onClick={() => void updateReport(report.id, "dismissed")}>
                          Dismiss
                        </button>
                      ) : null}
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="podcast-moderation-state">
              <span className="podcast-moderation-state-icon" aria-hidden="true">
                <AppIcon name="inbox" size="lg" />
              </span>
              <strong>Queue is clear</strong>
              <span>No podcast reports are waiting in the authorized queue.</span>
            </div>
          )}
        </section>

        {canModerateEpisodes ? (
          <section className="podcast-moderation-card">
            <header className="podcast-moderation-card-header">
              <div>
                <p className="podcast-moderation-card-eyebrow">Episode policy</p>
                <h3>Published episodes</h3>
              </div>
              <span className="podcast-moderation-card-badge" aria-hidden="true">
                <AppIcon name="lock" size="sm" />
              </span>
            </header>

            {publishedEpisodes.length ? (
              <div className="podcast-episode-policy-list">
                {publishedEpisodes.map((episode) => (
                  <article key={episode.id} className="podcast-episode-policy-card">
                    <div className="podcast-episode-policy-copy">
                      <strong>{episode.title}</strong>
                      <div className="podcast-episode-policy-meta">
                        <span>{episode.listenerCount.toLocaleString()} listeners</span>
                        <span className={episode.isExplicit ? "is-explicit" : "is-standard"}>
                          {episode.isExplicit ? "Explicit" : "Standard"}
                        </span>
                      </div>
                    </div>
                    <footer className="podcast-episode-policy-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openIntent({ kind: "episode", targetId: episode.id, label: episode.title, action: "unpublish" })}
                      >
                        Unpublish
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        disabled={busy}
                        onClick={() => openIntent({ kind: "episode", targetId: episode.id, label: episode.title, action: "archive" })}
                      >
                        Archive
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="podcast-moderation-state is-compact">
                <span className="podcast-moderation-state-icon" aria-hidden="true">
                  <AppIcon name="headphones" size="lg" />
                </span>
                <strong>No published episodes</strong>
                <span>Policy controls appear when episodes are live.</span>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <aside className="podcast-moderation-policy">
        <AppIcon name="lock" size="sm" />
        <div>
          <strong>Policy boundary</strong>
          <p>Copyright and safety reports require a good-faith review. Preserve only bounded audit metadata and never copy private audio into reports.</p>
        </div>
      </aside>

      {intent ? (
        <div className="podcast-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setIntent(null)}>
          <section
            className="podcast-confirm-dialog podcast-moderation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="podcast-moderation-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="podcast-moderation-dialog-icon" aria-hidden="true">
              <AppIcon name={intent.kind === "comment" ? "trash" : "lock"} size="lg" />
            </span>
            <h3 id="podcast-moderation-title">Confirm moderation action</h3>
            <p>{intent.label}</p>
            <label>
              <span>Audit reason</span>
              <textarea
                autoFocus
                rows={4}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Describe the policy basis without including secrets or unrelated private content."
              />
              <small>{reason.length}/500 — minimum 10 characters</small>
            </label>
            <footer>
              <button type="button" disabled={busy} onClick={() => setIntent(null)}>
                Cancel
              </button>
              <button type="button" className="danger" disabled={busy || reason.trim().length < 10} onClick={() => void confirm()}>
                {busy ? "Applying..." : "Apply action"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
