import { useEffect, useState } from "react";
import type { ReportReason, ReportTargetType } from "../types/reports";
import { reportService } from "../services/reportService";
import { AppIcon } from "./AppIcon";

export type ReportModalTarget = { targetType: ReportTargetType; targetId: string; label: string; communityId?: string; channelId?: string };
type Props = { target: ReportModalTarget; reporterId: string; onClose: () => void; onResult: (message: string, ok: boolean) => void };
const reasons: Array<{ value: ReportReason; label: string }> = [{ value: "spam", label: "Spam" }, { value: "harassment", label: "Harassment" }, { value: "unsafe_content", label: "Unsafe content" }, { value: "impersonation", label: "Impersonation" }, { value: "other", label: "Other" }];

export function ReportModal({ target, reporterId, onClose, onResult }: Props) {
  const [reason, setReason] = useState<ReportReason>("other");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [busy, onClose]);
  const submit = async () => { setBusy(true); const result = await reportService.submitReport({ communityId: target.communityId, channelId: target.channelId, reporterId, targetType: target.targetType, targetId: target.targetId, reason, description }); onResult(result.ok ? "Report submitted for moderator review." : result.message, result.ok); setBusy(false); if (result.ok) onClose(); };
  return <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Safety report</p><h2 id="report-modal-title">Report {target.targetType}</h2><span>{target.label}</span></div><button className="icon-button" type="button" aria-label="Close report" disabled={busy} onClick={onClose}><AppIcon name="close" size="lg" /></button></header><div className="report-modal-body"><label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Additional details</span><textarea rows={5} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened without including passwords, tokens, or unrelated private content." /></label><small>Reports are visible only to authorized community moderators, admins, and owners.</small></div><footer><button className="secondary-action" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="danger-action" type="button" disabled={busy} onClick={() => void submit()}><AppIcon name="bell" size="sm" />{busy ? "Submitting..." : "Submit report"}</button></footer></section></div>;
}
