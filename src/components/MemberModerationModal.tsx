import { useState } from "react";
import type { Member } from "../types/community";
import type { MemberModerationAction } from "../types/memberModeration";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";

type MemberModerationModalProps = {
  member: Member;
  action: MemberModerationAction;
  onClose: () => void;
  onConfirm: (reason: string, timeoutMinutes?: number) => Promise<boolean>;
};

const actionCopy: Record<MemberModerationAction, { title: string; description: string; button: string }> = {
  kick: { title: "Remove member", description: "This member will leave the community and may join again later if access permits.", button: "Remove member" },
  ban: { title: "Ban member", description: "This member will be removed and blocked from joining until the ban is reviewed.", button: "Ban member" },
  timeout: { title: "Timeout member", description: "Temporarily restrict this member. Existing content remains unchanged.", button: "Apply timeout" },
};

export function MemberModerationModal({ member, action, onClose, onConfirm }: MemberModerationModalProps) {
  const [reason, setReason] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const copy = actionCopy[action];
  const dialogRef = useDialogFocusTrap<HTMLFormElement>(onClose);

  return <div className="member-moderation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form ref={dialogRef} tabIndex={-1} className="member-moderation-modal" role="alertdialog" aria-modal="true" aria-labelledby="member-moderation-title" aria-describedby="member-moderation-description" onSubmit={async (event) => {
      event.preventDefault();
      if (reason.trim().length < 3 || submitting) return;
      setSubmitting(true);
      try { if (await onConfirm(reason.trim(), action === "timeout" ? timeoutMinutes : undefined)) onClose(); } finally { setSubmitting(false); }
    }}>
      <header>
        <div><span className="eyebrow">Member management</span><h2 id="member-moderation-title">{copy.title}</h2></div>
        <button type="button" className="icon-button" aria-label="Close member moderation" onClick={onClose}><AppIcon name="close" size="md" /></button>
      </header>
      <div className="member-moderation-target"><span className="avatar-fallback">{member.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{member.displayName}</strong><small>@{member.username}</small></div></div>
      <p id="member-moderation-description">{copy.description}</p>
      {action === "timeout" ? <label>Timeout duration<select value={timeoutMinutes} onChange={(event) => setTimeoutMinutes(Number(event.target.value))}><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={1440}>24 hours</option><option value={10080}>7 days</option></select></label> : null}
      <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} autoFocus data-dialog-initial-focus placeholder="Add a clear moderation reason" /><small>{reason.trim().length}/500 · minimum 3 characters</small></label>
      <footer><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="submit" className="danger-action" disabled={reason.trim().length < 3 || submitting}>{submitting ? "Applying..." : copy.button}</button></footer>
    </form>
  </div>;
}
