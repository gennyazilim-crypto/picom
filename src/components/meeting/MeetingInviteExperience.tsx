import { useCallback, useEffect, useRef, useState } from "react";
import { clipboardService } from "../../services/clipboardService";
import { meetingSchedulingService } from "../../services/meeting/meetingSchedulingService";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingInviteSummary, MeetingJoinPreview } from "../../types/meetingScheduling";
import { AppIcon } from "../AppIcon";
import { MeetingJoinPreviewCard } from "./MeetingJoinPreviewCard";
import "./MeetingInviteExperience.css";

type ConfirmAction = Readonly<{ kind: "revoke" | "regenerate"; invite: MeetingInviteSummary }>;
const localDateTime = (timestamp: number) => { const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); };
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function MeetingInviteExperience({ snapshot, hostName }: { snapshot: MeetingClientSnapshot; hostName: string }) {
  const context = snapshot.context;
  const canManage = snapshot.capabilities.canInvite;
  const [preview, setPreview] = useState<MeetingJoinPreview | null>(null);
  const [invites, setInvites] = useState<readonly MeetingInviteSummary[]>([]);
  const [expiryHours, setExpiryHours] = useState(24);
  const [maxUses, setMaxUses] = useState(10);
  const [guestPolicy, setGuestPolicy] = useState<"authenticated_only" | "signed_in_guest">("authenticated_only");
  const [scheduledFor, setScheduledFor] = useState(() => localDateTime(Date.now() + 60 * 60_000));
  const [scheduledEndAt, setScheduledEndAt] = useState(() => localDateTime(Date.now() + 2 * 60 * 60_000));
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const retryCopyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!context) return;
    const previewResult = await meetingSchedulingService.getJoinPreview(context.roomId);
    if (previewResult.ok) setPreview({ ...previewResult.data, hostName: previewResult.data.hostName ?? hostName });
    else setError(previewResult.error.message);
    if (!canManage) return;
    const inviteResult = await meetingSchedulingService.listInvites(context.roomId);
    if (inviteResult.ok) setInvites(inviteResult.data);
    else setError(inviteResult.error.message);
  }, [canManage, context, hostName]);

  useEffect(() => { void load(); return () => { retryCopyRef.current = null; }; }, [load]);

  const input = () => ({ roomId: context!.roomId, communityId: context!.communityId, channelId: context!.channelId, sessionId: context!.sessionId, role: guestPolicy === "signed_in_guest" ? "guest" as const : "participant" as const, guestPolicy, expiresAt: new Date(Date.now() + expiryHours * 60 * 60_000).toISOString(), maxUses });
  const copySecretLink = async (link: string, success: string) => { const copied = await clipboardService.copyText(link); retryCopyRef.current = copied.ok ? null : link; if (copied.ok) { setNotice(success); setError(""); } else setError("The invite was created, but Picom could not access the clipboard. Use Retry copy or regenerate the invite."); };

  const create = async () => {
    if (!context || busy) return;
    setBusy("create"); setError(""); setNotice("");
    const result = await meetingSchedulingService.createInvite(input());
    if (result.ok) { await copySecretLink(result.data.deepLink, "Secure meeting link created and copied."); await load(); }
    else setError(result.error.message);
    setBusy("");
  };

  const applyConfirmed = async () => {
    if (!confirm || busy) return;
    const action = confirm; setBusy(`${action.kind}-${action.invite.id}`); setError(""); setNotice("");
    if (action.kind === "revoke") {
      const result = await meetingSchedulingService.revokeInvite(action.invite.id);
      if (result.ok) { setNotice("Meeting invite revoked."); await load(); } else setError(result.error.message);
    } else {
      const result = await meetingSchedulingService.regenerateInvite(action.invite.id, input());
      if (result.ok) { await copySecretLink(result.data.deepLink, "Old link revoked; replacement link copied."); await load(); } else setError(result.error.message);
    }
    setBusy(""); setConfirm(null);
  };

  const schedule = async () => {
    if (!context || busy) return;
    const start = new Date(scheduledFor), end = new Date(scheduledEndAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) { setError("Choose a valid meeting start and end time."); return; }
    setBusy("schedule"); setError(""); setNotice("");
    const result = await meetingSchedulingService.schedule({ roomId: context.roomId, scheduledFor: start.toISOString(), scheduledEndAt: end.toISOString(), reminderPolicy: { enabled: true, minutesBefore: [15] } });
    if (result.ok) { setNotice("Meeting schedule saved with a 15 minute reminder policy."); await load(); } else setError(result.error.message);
    setBusy("");
  };

  return <section className="meeting-invite-experience" aria-label="Meeting invitations and schedule">
    {preview ? <MeetingJoinPreviewCard preview={preview} /> : <div className="meeting-invite-loading" role="status">Loading join preview...</div>}
    {canManage ? <>
      <section className="meeting-invite-section"><h3>Create secure invite</h3><div className="meeting-invite-form"><label>Access<select value={guestPolicy} onChange={(event) => setGuestPolicy(event.target.value as typeof guestPolicy)}><option value="authenticated_only">Authenticated participant</option><option value="signed_in_guest">Signed-in guest</option></select></label><label>Expires<select value={expiryHours} onChange={(event) => setExpiryHours(Number(event.target.value))}><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label><label>Use limit<input type="number" min={1} max={100} value={maxUses} onChange={(event) => setMaxUses(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label></div><button type="button" className="meeting-copy-link meeting-invite-primary" disabled={Boolean(busy)} onClick={() => void create()}><AppIcon name="reply" size="xs" />{busy === "create" ? "Creating..." : "Create and copy link"}</button>{retryCopyRef.current ? <button type="button" className="meeting-copy-link" onClick={() => { const link = retryCopyRef.current; if (link) void copySecretLink(link, "Meeting link copied."); }}>Retry copy</button> : null}</section>
      <section className="meeting-invite-section"><h3>Schedule</h3><div className="meeting-schedule-form"><label>Starts<input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label><label>Ends<input type="datetime-local" value={scheduledEndAt} onChange={(event) => setScheduledEndAt(event.target.value)} /></label></div><button type="button" className="meeting-copy-link" disabled={Boolean(busy)} onClick={() => void schedule()}>{busy === "schedule" ? "Saving..." : "Save schedule"}</button></section>
      <section className="meeting-invite-section"><h3>Invite lifecycle <span>{invites.length}</span></h3><div className="meeting-invite-list">{invites.length ? invites.map((invite) => <article key={invite.id}><div><strong>{invite.role.replace(/_/g, " ")}</strong><small>{invite.status} · {invite.useCount}/{invite.maxUses} uses · expires {formatDate(invite.expiresAt)}</small></div>{invite.status === "active" ? <span><button type="button" disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "regenerate", invite })}>Regenerate</button><button type="button" className="is-danger" disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "revoke", invite })}>Revoke</button></span> : null}</article>) : <p>No meeting invites yet.</p>}</div></section>
    </> : <p className="meeting-invite-readonly"><AppIcon name="lock" size="xs" />Only authorized hosts and cohosts can manage meeting invitations.</p>}
    {notice ? <p className="meeting-invite-notice" role="status">{notice}</p> : null}{error ? <p className="meeting-dock-error" role="alert">{error}</p> : null}
    {confirm ? <div className="meeting-waiting-confirm" role="alertdialog" aria-modal="true" aria-labelledby="meeting-invite-confirm-title"><div><strong id="meeting-invite-confirm-title">{confirm.kind === "revoke" ? "Revoke this invite?" : "Regenerate this invite?"}</strong><p>{confirm.kind === "revoke" ? "People with this link will no longer be able to use it." : "The old link will be revoked and a replacement will be created and copied."}</p><span><button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => setConfirm(null)}>Cancel</button><button type="button" className={confirm.kind === "revoke" ? "is-danger" : ""} disabled={Boolean(busy)} onClick={() => void applyConfirmed()}>Confirm</button></span></div></div> : null}
  </section>;
}
