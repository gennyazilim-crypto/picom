import { useCallback, useState } from "react";
import type { ReportReason, ReportTargetType } from "../types/reports";
import { reportService } from "../services/reportService";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon, type IconName } from "./AppIcon";

export type ReportModalTarget = { targetType: ReportTargetType; targetId: string; label: string; communityId?: string; channelId?: string; conversationId?: string; evidenceExcerpt?: string };
type Props = { target: ReportModalTarget; reporterId: string; onClose: () => void; onResult: (message: string, ok: boolean) => void };

const reasons: Array<{ value: ReportReason; label: string; description: string }> = [
  { value: "spam", label: "Spam or scam", description: "Repeated, deceptive, or unwanted activity." },
  { value: "harassment", label: "Harassment", description: "Targeted abuse, threats, or unwanted contact." },
  { value: "unsafe_content", label: "Unsafe content", description: "Content that may create a credible safety risk." },
  { value: "impersonation", label: "Impersonation", description: "Misleading identity or affiliation claims." },
  { value: "copyright", label: "Copyright or rights concern", description: "Audio, artwork, or text may be used without authorization." },
  { value: "other", label: "Something else", description: "Another Community Guidelines concern." },
];

const targetTitles: Record<ReportTargetType, string> = { message: "message", direct_message: "direct message", user: "user", community: "community", radio_session: "radio session", podcast_episode: "Podcast episode", podcast_comment: "Podcast comment" };

const reasonIcons: Record<ReportReason, IconName> = {
  spam: "inbox",
  harassment: "users",
  unsafe_content: "eye",
  impersonation: "user",
  copyright: "lock",
  other: "more",
};

const targetIcons: Partial<Record<ReportTargetType, IconName>> = {
  message: "hash",
  direct_message: "inbox",
  user: "user",
  community: "users",
  radio_session: "voice",
  podcast_episode: "play",
  podcast_comment: "reply",
};

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
    const result = await reportService.submitReport({ communityId: target.communityId, channelId: target.channelId, conversationId: target.conversationId, reporterId, targetType: target.targetType, targetId: target.targetId, reason, description, evidenceExcerpt: target.evidenceExcerpt });
    setBusy(false);
    if (!result.ok) { onResult(result.message, false); return; }
    setSubmitted(true);
    onResult(target.conversationId ? "Report submitted to Picom Safety for review." : "Report submitted for moderator review.", true);
  };

  return <div className="modal-backdrop" onMouseDown={close}>
    <section ref={dialogRef} tabIndex={-1} className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="report-modal-header">
        <div className="report-modal-header-main">
          <span className="report-modal-header-icon" aria-hidden="true">
            <AppIcon name={targetIcons[target.targetType] ?? "bell"} size="md" />
          </span>
          <div className="report-modal-header-copy">
            <span className="report-modal-header-badge">Safety report</span>
            <h2 id="report-modal-title">Report {targetTitles[target.targetType]}</h2>
            <p className="report-modal-header-target">{target.label}</p>
          </div>
        </div>
        <button className="report-modal-close icon-button" type="button" aria-label="Close report" disabled={busy} onClick={close}>
          <AppIcon name="close" size="lg" />
        </button>
      </header>
      {submitted ? <div className="report-confirmation" role="status">
        <span className="report-confirmation-icon"><AppIcon name="inbox" size="xl" /></span>
        <h3>Report received</h3>
        <p>{target.conversationId ? "Authorized Picom Safety reviewers can inspect only the selected target and required account metadata. The rest of your private conversation is not attached." : "Authorized community moderators can review this report and the permitted target context. Picom does not attach unrelated private content."}</p>
        <small>If the situation changes, use blocking and safety controls as needed. For immediate danger, contact local emergency services.</small>
      </div> : <div className="report-modal-body">
        {target.evidenceExcerpt ? (
          <div className="report-evidence" aria-label="Selected direct message">
            <span className="report-evidence-label">Selected message</span>
            <blockquote cite={target.targetId}>{target.evidenceExcerpt.slice(0, 280)}</blockquote>
          </div>
        ) : null}
        <section className="report-reason-section" aria-labelledby="report-reason-heading">
          <h3 id="report-reason-heading">What is the concern?</h3>
          <fieldset className="report-reason-grid">
            <legend className="sr-only">Report reason</legend>
            {reasons.map((item) => (
              <label key={item.value} className={reason === item.value ? "selected" : ""}>
                <input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />
                <span className="report-reason-card">
                  <span className="report-reason-icon" aria-hidden="true"><AppIcon name={reasonIcons[item.value]} size="sm" /></span>
                  <span className="report-reason-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="report-reason-check" aria-hidden="true" />
                </span>
              </label>
            ))}
          </fieldset>
        </section>
        <section className="report-details-section" aria-labelledby="report-details-heading">
          <label htmlFor="report-details-input">
            <span className="report-details-heading" id="report-details-heading">
              <span>Additional details</span>
              <em>Optional</em>
              <small className="report-char-count">{description.length}/1000</small>
            </span>
            <textarea id="report-details-input" rows={4} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened. Do not include passwords, tokens, or unrelated private content." />
          </label>
        </section>
        <div className="report-notices">
          <aside className="report-notice report-notice--warning">
            <AppIcon name="lock" size="sm" />
            <span><strong>Report in good faith.</strong> False, duplicate, or abusive reports can delay safety reviews and may be investigated.</span>
          </aside>
          <p className="report-notice report-notice--privacy">Only authorized moderators, admins, and owners for this community can access the report queue. Target access remains permission checked.</p>
        </div>
      </div>}
      <footer className="report-modal-footer">
        {submitted ? (
          <button className="report-modal-done" type="button" onClick={close}>Done</button>
        ) : (
          <>
            <p className="report-modal-footer-note">Your report stays private to authorized reviewers.</p>
            <div className="report-modal-footer-actions">
              <button className="report-modal-cancel" type="button" disabled={busy} onClick={close}>Cancel</button>
              <button className="report-modal-submit" type="button" disabled={busy} onClick={() => void submit()}>
                <AppIcon name="bell" size="sm" />
                {busy ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </>
        )}
      </footer>
    </section>
  </div>;
}
