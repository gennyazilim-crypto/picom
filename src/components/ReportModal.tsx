import { useCallback, useState } from "react";
import type { ReportReason, ReportTargetType } from "../types/reports";
import { reportService } from "../services/reportService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";

export type ReportModalTarget = { targetType: ReportTargetType; targetId: string; label: string; communityId?: string; channelId?: string };
type Props = { target: ReportModalTarget; reporterId: string; onClose: () => void; onResult: (message: string, ok: boolean) => void };

const reasons: Array<{ value: ReportReason; label: string; description: string }> = [
  { value: "spam", label: "Spam or scam", description: "Repeated, deceptive, or unwanted activity." },
  { value: "harassment", label: "Harassment", description: "Targeted abuse, threats, or unwanted contact." },
  { value: "unsafe_content", label: "Unsafe content", description: "Content that may create a credible safety risk." },
  { value: "impersonation", label: "Impersonation", description: "Misleading identity or affiliation claims." },
  { value: "copyright", label: "Copyright or rights concern", description: "Audio, artwork, or text may be used without authorization." },
  { value: "other", label: "Something else", description: "Another Community Guidelines concern." },
];

const targetTitles: Record<ReportTargetType, string> = { message: "message", user: "user", community: "community", podcast_episode: "Podcast episode", podcast_comment: "Podcast comment" };

export function ReportModal({ target, reporterId, onClose, onResult }: Props) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(close);

  const submit = async () => {
    if (busy || submitted) return;
    setBusy(true);
    const result = await reportService.submitReport({ communityId: target.communityId, channelId: target.channelId, reporterId, targetType: target.targetType, targetId: target.targetId, reason, description });
    setBusy(false);
    if (!result.ok) { onResult(result.message, false); return; }
    setSubmitted(true);
    onResult("Report submitted for moderator review.", true);
  };

  return <div className="modal-backdrop" onMouseDown={close}>
    <section ref={dialogRef} tabIndex={-1} className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Safety report</p><h2 id="report-modal-title">Report {targetTitles[target.targetType]}</h2><span>{target.label}</span></div><button className="icon-button" type="button" aria-label="Close report" disabled={busy} onClick={close}><AppIcon name="close" size="lg" /></button></header>
      {submitted ? <div className="report-confirmation" role="status">
        <span className="report-confirmation-icon"><AppIcon name="inbox" size="xl" /></span>
        <h3>Report received</h3>
        <p>Authorized community moderators can review this report and the permitted target context. Picom does not attach unrelated private content.</p>
        <small>If the situation changes, use blocking and safety controls as needed. For immediate danger, contact local emergency services.</small>
      </div> : <div className="report-modal-body">
        <fieldset className="report-reason-grid"><legend>What is the concern?</legend>{reasons.map((item) => <label key={item.value} className={reason === item.value ? "selected" : ""}><input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</fieldset>
        <label><span>Additional details <em>Optional</em></span><textarea rows={5} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened. Do not include passwords, tokens, or unrelated private content." /><small>{description.length}/1000 characters</small></label>
        <aside className="report-abuse-warning"><AppIcon name="lock" size="sm" /><span><strong>Report in good faith.</strong> False, duplicate, or abusive reports can delay safety reviews and may be investigated.</span></aside>
        <small>Only authorized moderators, admins, and owners for this community can access the report queue. Target access remains permission checked.</small>
      </div>}
      <footer>{submitted ? <button className="send-button" type="button" onClick={close}>Done</button> : <><button className="secondary-action" type="button" disabled={busy} onClick={close}>Cancel</button><button className="danger-action" type="button" disabled={busy} onClick={() => void submit()}><AppIcon name="bell" size="sm" />{busy ? "Submitting..." : "Submit report"}</button></>}</footer>
    </section>
  </div>;
}
