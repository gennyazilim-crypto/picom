import { useCallback, useEffect, useMemo, useState } from "react";
import { podcastModerationService } from "../../services/audio/podcastModerationService";
import type { PodcastEpisode } from "../../types/audio";
import type { ReportRecord, ReportStatus } from "../../types/reports";
import { AppIcon } from "../AppIcon";

type Intent =
  | { kind: "comment"; targetId: string; label: string; reportId?: string }
  | { kind: "episode"; targetId: string; label: string; action: "unpublish" | "archive"; reportId?: string };

type Props = { communityId: string; episodes: readonly PodcastEpisode[]; canModerateComments: boolean; canModerateEpisodes: boolean; onEpisodeChanged: (episode?: PodcastEpisode) => void };

export function PodcastModerationPanel({ communityId, episodes, canModerateComments, canModerateEpisodes, onEpisodeChanged }: Props) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [reason, setReason] = useState("");
  const canModerate = canModerateComments || canModerateEpisodes;
  const publishedEpisodes = useMemo(() => episodes.filter((episode) => episode.status === "published"), [episodes]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await podcastModerationService.listReports(communityId, { canModerateComments, canModerateEpisodes });
    setLoading(false);
    if (!result.ok) { setNotice(result.message); return; }
    setReports([...result.data]);
  }, [canModerateComments, canModerateEpisodes, communityId]);

  useEffect(() => { void load(); }, [load]);

  const updateReport = async (reportId: string, status: ReportStatus) => {
    setBusy(true); setNotice(null);
    const result = await podcastModerationService.updateReportStatus(reportId, status, canModerate);
    setBusy(false);
    if (!result.ok) { setNotice(result.message); return; }
    setReports((current) => current.map((report) => report.id === result.data.id ? result.data : report));
    setNotice(`Report marked ${status.replace("_", " ")}.`);
  };

  const confirm = async () => {
    if (!intent || reason.trim().length < 10 || busy) return;
    setBusy(true); setNotice(null);
    if (intent.kind === "comment") {
      const result = await podcastModerationService.moderateComment(intent.targetId, reason);
      if (!result.ok) { setBusy(false); setNotice(result.error.message); return; }
    } else {
      const result = await podcastModerationService.moderateEpisode(intent.targetId, intent.action, reason);
      if (!result.ok) { setBusy(false); setNotice(result.error.message); return; }
      onEpisodeChanged(result.data);
    }
    if (intent.reportId) {
      const reportResult = await podcastModerationService.updateReportStatus(intent.reportId, "action_taken", canModerate);
      if (reportResult.ok) setReports((current) => current.map((report) => report.id === reportResult.data.id ? reportResult.data : report));
    }
    setBusy(false); setIntent(null); setReason(""); setNotice("Moderation action completed and added to the audit log.");
  };

  if (!canModerate) return <div className="podcast-shell-empty"><AppIcon name="lock" size="xl" /><strong>Moderation access required</strong><p>Your assigned community role does not include Podcast moderation.</p></div>;

  return <section className="podcast-moderation-panel" aria-label="Podcast moderation">
    <div className="podcast-shell-section-heading"><div><span>TRUST AND SAFETY</span><h2>Podcast moderation</h2></div><p>Review Podcast reports and apply policy actions with an audit reason.</p></div>
    {notice ? <div className="podcast-publisher-alert" role="status"><AppIcon name="bell" size="sm" /><span>{notice}</span></div> : null}
    <div className={`podcast-moderation-grid ${canModerateEpisodes ? "" : "comments-only"}`}>
      <section><header><div><span>REPORT QUEUE</span><h3>Podcast reports</h3></div><button type="button" disabled={loading || busy} onClick={() => void load()}><AppIcon name="inbox" size="sm" />Refresh</button></header>
        {loading ? <p className="podcast-moderation-empty">Loading authorized reports...</p> : reports.length ? <div className="podcast-report-list">{reports.map((report) => {
          const episode = report.targetType === "podcast_episode" ? episodes.find((item) => item.id === report.targetId) : undefined;
          const label = episode?.title ?? (report.targetType === "podcast_comment" ? `Podcast comment ${report.targetId.slice(0, 8)}` : `Episode ${report.targetId.slice(0, 8)}`);
          return <article key={report.id}><div><span className={`podcast-report-status ${report.status}`}>{report.status.replace("_", " ")}</span><strong>{label}</strong><small>{report.reason.replace("_", " ")} - {report.description}</small></div><footer>{report.status === "open" ? <button type="button" disabled={busy} onClick={() => void updateReport(report.id, "reviewed")}>Review</button> : null}{report.targetType === "podcast_comment" && canModerateComments && report.status !== "action_taken" ? <button type="button" className="danger" disabled={busy} onClick={() => { setIntent({ kind: "comment", targetId: report.targetId, label, reportId: report.id }); setReason(""); }}><AppIcon name="trash" size="xs" />Remove comment</button> : null}{report.targetType === "podcast_episode" && canModerateEpisodes && report.status !== "action_taken" ? <button type="button" className="danger" disabled={busy || !episode} onClick={() => { setIntent({ kind: "episode", targetId: report.targetId, label, action: "archive", reportId: report.id }); setReason(""); }}><AppIcon name="lock" size="xs" />Archive episode</button> : null}{report.status !== "dismissed" && report.status !== "action_taken" ? <button type="button" disabled={busy} onClick={() => void updateReport(report.id, "dismissed")}>Dismiss</button> : null}</footer></article>;
        })}</div> : <p className="podcast-moderation-empty">No Podcast reports are waiting in the authorized queue.</p>}
      </section>
      {canModerateEpisodes ? <section><header><div><span>EPISODE POLICY</span><h3>Published episodes</h3></div><AppIcon name="lock" size="sm" /></header>{publishedEpisodes.length ? <div className="podcast-episode-policy-list">{publishedEpisodes.map((episode) => <article key={episode.id}><div><strong>{episode.title}</strong><small>{episode.listenerCount} listeners - {episode.isExplicit ? "Explicit" : "Standard"}</small></div><footer><button type="button" disabled={busy} onClick={() => { setIntent({ kind: "episode", targetId: episode.id, label: episode.title, action: "unpublish" }); setReason(""); }}>Unpublish</button><button type="button" className="danger" disabled={busy} onClick={() => { setIntent({ kind: "episode", targetId: episode.id, label: episode.title, action: "archive" }); setReason(""); }}>Archive</button></footer></article>)}</div> : <p className="podcast-moderation-empty">No published episodes require policy controls.</p>}</section> : null}
    </div>
    <aside className="podcast-policy-notice"><AppIcon name="lock" size="sm" /><span><strong>Policy boundary</strong> Copyright and safety reports require a good-faith review. Preserve only bounded audit metadata and never copy private audio into reports.</span></aside>
    {intent ? <div className="podcast-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setIntent(null)}><section className="podcast-confirm-dialog podcast-moderation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="podcast-moderation-title" onMouseDown={(event) => event.stopPropagation()}><AppIcon name={intent.kind === "comment" ? "trash" : "lock"} size="lg" /><h3 id="podcast-moderation-title">Confirm moderation action</h3><p>{intent.label}</p><label><span>Audit reason</span><textarea autoFocus rows={4} maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Describe the policy basis without including secrets or unrelated private content." /><small>{reason.length}/500 - minimum 10 characters</small></label><footer><button type="button" disabled={busy} onClick={() => setIntent(null)}>Cancel</button><button type="button" className="danger" disabled={busy || reason.trim().length < 10} onClick={() => void confirm()}>{busy ? "Applying..." : "Apply action"}</button></footer></section></div> : null}
  </section>;
}
