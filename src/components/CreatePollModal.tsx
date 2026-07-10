import { useCallback, useState } from "react";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import type { CreatePollDraft } from "../types/polls";
import { AppIcon } from "./AppIcon";

export function CreatePollModal({ channelName, onClose, onCreate }: { channelName: string; onClose: () => void; onCreate: (draft: CreatePollDraft) => void | Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(close);
  const valid = Boolean(question.trim()) && options.filter((item) => item.trim()).length >= 2;
  const submit = async () => { if (!valid || busy) return; setBusy(true); try { await onCreate({ question: question.trim(), options: options.map((item) => item.trim()).filter(Boolean), allowMultiple, closesAt: closesAt ? new Date(closesAt).toISOString() : undefined }); onClose(); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={close}><section ref={dialogRef} tabIndex={-1} className="create-poll-modal" role="dialog" aria-modal="true" aria-labelledby="create-poll-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">#{channelName}</p><h2 id="create-poll-title">Create poll</h2></div><button type="button" className="icon-button" aria-label="Close poll creator" disabled={busy} onClick={close}><AppIcon name="close" size="lg" /></button></header><div className="create-poll-body"><label><span>Question</span><input autoFocus data-dialog-initial-focus maxLength={240} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should we decide?" /></label><div className="poll-option-editor"><span>Options</span>{options.map((option, index) => <div key={index}><input maxLength={100} value={option} onChange={(event) => setOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} />{options.length > 2 ? <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions((items) => items.filter((_, itemIndex) => itemIndex !== index))}><AppIcon name="close" size="xs" /></button> : null}</div>)}{options.length < 10 ? <button type="button" onClick={() => setOptions((items) => [...items, ""])}><AppIcon name="plus" size="sm" />Add option</button> : null}</div><label className="poll-toggle"><input type="checkbox" checked={allowMultiple} onChange={(event) => setAllowMultiple(event.target.checked)} /><span>Allow multiple choices</span></label><label><span>Close time <small>Optional</small></span><input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label></div><footer><button className="secondary-action" type="button" disabled={busy} onClick={close}>Cancel</button><button className="send-button" type="button" disabled={!valid || busy} onClick={() => void submit()}><AppIcon name="send" size="sm" />{busy ? "Creating..." : "Create poll"}</button></footer></section></div>;
}
