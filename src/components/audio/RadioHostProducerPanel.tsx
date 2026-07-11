import { useEffect, useMemo, useState, type FormEvent } from "react";
import { radioCoverService } from "../../services/audio/radioCoverService";
import { radioService } from "../../services/audio/radioService";
import type { RadioListenerState } from "../../services/audio/audioDataSource";
import type { RealtimeConnectionStatus } from "../../services/supabase/realtimeService";
import type { RadioCommunityShellSnapshot, RadioSession } from "../../types/audio";
import type { Community, Member } from "../../types/community";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { reportService } from "../../services/reportService";
import { RadioProductionTeamPanel } from "./RadioProductionTeamPanel";
import "./RadioHostProducerPanel.css";

type TransitionAction = "ended" | "cancelled";
type Props = Readonly<{
  community: Community;
  currentUser: Member;
  snapshot: RadioCommunityShellSnapshot;
  realtimeStatus: RealtimeConnectionStatus;
  connectionError?: string | null;
  onSessionChanged: (session: RadioSession) => void;
}>;

const dateTimeInput = (value?: string) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const statusLabel = (status: RadioSession["status"]) => status === "live" ? "On air" : status.charAt(0).toUpperCase() + status.slice(1);

export function RadioHostProducerPanel({ community, currentUser, snapshot, realtimeStatus, connectionError, onSessionChanged }: Props) {
  const manageable = useMemo(() => snapshot.sessions.filter((session) => ["draft", "scheduled", "live"].includes(session.status)), [snapshot.sessions]);
  const [sessionId, setSessionId] = useState(manageable[0]?.id ?? "new");
  const selected = snapshot.sessions.find((session) => session.id === sessionId) ?? null;
  const [title, setTitle] = useState(selected?.title ?? "");
  const [description, setDescription] = useState(selected?.description ?? "");
  const [startsAt, setStartsAt] = useState(dateTimeInput(selected?.startsAt));
  const [scheduledEndAt, setScheduledEndAt] = useState(selected?.scheduledEndAt ? dateTimeInput(selected.scheduledEndAt) : "");
  const [programId, setProgramId] = useState(selected?.programId ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [listeners, setListeners] = useState<RadioListenerState[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const [pendingTransition, setPendingTransition] = useState<TransitionAction | null>(null);

  useEffect(() => {
    setTitle(selected?.title ?? "");
    setDescription(selected?.description ?? "");
    setStartsAt(dateTimeInput(selected?.startsAt));
    setScheduledEndAt(selected?.scheduledEndAt ? dateTimeInput(selected.scheduledEndAt) : "");
    setProgramId(selected?.programId ?? "");
    setCoverFile(null);
  }, [selected?.description, selected?.id, selected?.programId, selected?.scheduledEndAt, selected?.startsAt, selected?.title]);

  useEffect(() => {
    let active = true;
    if (!selected) {
      setListeners([]);
      return () => { active = false; };
    }
    void radioService.getRadioListeners(selected.id).then((result) => {
      if (!active) return;
      if (result.ok) setListeners(result.data);
      else setNotice({ tone: "error", text: result.error.message });
    });
    return () => { active = false; };
  }, [selected?.id, selected?.listenerCount]);

  const publishSession = (session: RadioSession, text: string) => {
    onSessionChanged(session);
    setSessionId(session.id);
    setNotice({ tone: "status", text });
  };

  const saveSession = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !Number.isFinite(Date.parse(startsAt))) {
      setNotice({ tone: "error", text: "Enter a title and a valid broadcast time." });
      return;
    }
    setBusy("save");
    setNotice(null);
    const payload = {
      title,
      description,
      startsAt: new Date(startsAt).toISOString(),
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : null,
      programId: programId || null,
    };
    const saved = selected
      ? await radioService.updateRadioSchedule(selected.id, payload)
      : await radioService.startRadioSession({ communityId: community.id, title, description, startsAt: payload.startsAt, programId: programId || undefined, scheduledEndAt: payload.scheduledEndAt ?? undefined, status: "scheduled" });
    if (!saved.ok) {
      setBusy(null);
      setNotice({ tone: "error", text: saved.error.message });
      return;
    }
    let finalSession = saved.data;
    onSessionChanged(finalSession);
    if (coverFile) {
      const cover = await radioCoverService.uploadCover(community.id, finalSession.id, coverFile);
      if (!cover.ok) {
        setBusy(null);
        setNotice({ tone: "error", text: "The schedule was saved, but " + cover.error.message.toLowerCase() });
        setSessionId(finalSession.id);
        return;
      }
      const updated = await radioService.updateRadioSchedule(finalSession.id, { coverUrl: cover.data.url, coverStoragePath: cover.data.storagePath ?? null });
      if (!updated.ok) {
        if (cover.data.storagePath) await radioCoverService.removeCover(cover.data.storagePath);
        setBusy(null);
        setNotice({ tone: "error", text: updated.error.message });
        setSessionId(finalSession.id);
        return;
      }
      finalSession = updated.data;
    }
    setBusy(null);
    setCoverFile(null);
    publishSession(finalSession, selected ? "Radio session updated." : "Radio session scheduled.");
  };

  const transition = async (next: "live" | TransitionAction) => {
    if (!selected) return;
    setBusy(next);
    setNotice(null);
    const result = next === "live"
      ? await radioService.goLive(selected.id)
      : next === "ended"
        ? await radioService.endRadioSession(selected.id)
        : await radioService.cancelRadioSchedule(selected.id);
    setBusy(null);
    setPendingTransition(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error.message });
      return;
    }
    publishSession(result.data, next === "live" ? "Broadcast is live." : next === "ended" ? "Broadcast ended." : "Broadcast cancelled.");
  };

  const moderate = async (listener: RadioListenerState, action: "mute" | "unmute" | "remove") => {
    if (!selected) return;
    setBusy("listener-" + listener.userId);
    const result = await radioService.moderateRadioListener(selected.id, listener.userId, action);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error.message });
      return;
    }
    setListeners((current) => action === "remove"
      ? current.filter((item) => item.userId !== listener.userId)
      : current.map((item) => item.userId === listener.userId ? { ...item, muted: action === "mute" } : item));
    setNotice({ tone: "status", text: action === "remove" ? "Listener removed." : action === "mute" ? "Listener muted." : "Listener unmuted." });
  };

  const reportListener = async (listener: RadioListenerState) => {
    if (!selected || listener.userId === currentUser.userId) return;
    setBusy("report-" + listener.userId);
    const result = await reportService.submitReport({ communityId: community.id, reporterId: currentUser.userId, targetType: "user", targetId: listener.userId, reason: "other", description: "Reported from Radio session moderation: " + selected.title });
    setBusy(null);
    setNotice(result.ok ? { tone: "status", text: "Listener report submitted to the moderation queue." } : { tone: "error", text: result.message });
  };

  const listenerMember = (userId: string) => community.members.find((member) => member.userId === userId);
  const terminal = selected ? ["ended", "cancelled"].includes(selected.status) : false;
  const actorRole = community.roles.find((role) => role.id === currentUser.roleId);
  const actorIsOwner = community.ownerId === currentUser.userId;
  const canModerateTarget = (member: Member | undefined, userId: string) => {
    if (userId === currentUser.userId || userId === community.ownerId) return false;
    if (actorIsOwner) return true;
    const targetRole = member ? community.roles.find((role) => role.id === member.roleId) : undefined;
    return (actorRole?.level ?? 0) > (targetRole?.level ?? 0);
  };

  return <section className="radio-production-desk" aria-labelledby="radio-production-title">
    <header className="radio-production-header">
      <div className="radio-production-heading"><span aria-hidden="true"><AppIcon name="microphone" size="lg" /></span><div><small>HOST & PRODUCER DESK</small><h2 id="radio-production-title">Broadcast management</h2><p>Signed in as {currentUser.displayName}</p></div></div>
      <div className="radio-production-health" aria-label="Radio service state"><span className={"connection " + realtimeStatus}><i />{realtimeStatus === "connected" ? "Realtime connected" : "Realtime " + realtimeStatus}</span><span>{selected ? statusLabel(selected.status) : "New schedule"}</span><span>{selected?.listenerCount ?? 0} listeners</span></div>
    </header>
    {connectionError ? <div className="radio-production-notice error" role="alert">{connectionError}</div> : null}
    {notice ? <div className={"radio-production-notice " + notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div> : null}

    <div className="radio-production-grid">
      <form className="radio-production-form" onSubmit={(event) => void saveSession(event)}>
        <label className="wide"><span>Session</span><select value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="new">Create a new schedule</option>{snapshot.sessions.map((session) => <option key={session.id} value={session.id}>{session.title} - {statusLabel(session.status)}</option>)}</select></label>
        <label><span>Title</span><input value={title} maxLength={120} disabled={terminal || busy !== null} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label><span>Program</span><select value={programId} disabled={terminal || busy !== null} onChange={(event) => setProgramId(event.target.value)}><option value="">No program</option>{snapshot.programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}</select></label>
        <label className="wide"><span>Description</span><textarea value={description} maxLength={4000} rows={3} disabled={terminal || busy !== null} onChange={(event) => setDescription(event.target.value)} /></label>
        <label><span>Starts</span><input type="datetime-local" value={startsAt} disabled={terminal || busy !== null} onChange={(event) => setStartsAt(event.target.value)} required /></label>
        <label><span>Scheduled end</span><input type="datetime-local" value={scheduledEndAt} disabled={terminal || busy !== null} onChange={(event) => setScheduledEndAt(event.target.value)} /></label>
        <label className="radio-cover-field wide"><span>Cover image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={terminal || busy !== null} onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} /><small>{coverFile?.name ?? (selected?.coverStoragePath ? "Private cover stored" : "PNG, JPG, WEBP, or GIF up to 5 MB")}</small></label>
        <div className="radio-production-actions wide">
          <button className="primary-button compact" type="submit" disabled={terminal || busy !== null}><AppIcon name={selected ? "edit" : "plus"} size="sm" />{selected ? "Save changes" : "Create schedule"}</button>
          {selected && ["draft", "scheduled"].includes(selected.status) ? <button type="button" disabled={busy !== null} onClick={() => void transition("live")}><AppIcon name="play" size="sm" />Start broadcast</button> : null}
          {selected?.status === "live" ? <button type="button" className="danger" disabled={busy !== null} onClick={() => setPendingTransition("ended")}><AppIcon name="close" size="sm" />End broadcast</button> : null}
          {selected && ["draft", "scheduled"].includes(selected.status) ? <button type="button" className="danger ghost" disabled={busy !== null} onClick={() => setPendingTransition("cancelled")}><AppIcon name="bell" size="sm" />Cancel schedule</button> : null}
        </div>
      </form>

      <aside className="radio-production-side">
        {selected ? <RadioProductionTeamPanel community={community} currentUser={currentUser} session={selected} /> : null}
        <section className="radio-audience-controls">
          <header><div><small>LIVE AUDIENCE</small><strong>Listener moderation</strong></div><span>{listeners.length}</span></header>
          {selected?.status !== "live" ? <p>Listener controls become available while this session is live.</p> : listeners.length ? listeners.map((listener) => {
            const member = listenerMember(listener.userId);
            const permitted = canModerateTarget(member, listener.userId);
            return <div className="radio-listener-control" key={listener.userId}>
              {member ? <MemberAvatar member={member} size={30} /> : <span className="radio-listener-fallback"><AppIcon name="users" size="sm" /></span>}
              <span><strong>{member?.displayName ?? "Authorized listener"}</strong><small>{listener.muted ? "Muted by host" : "Listening"}</small></span>
              <button type="button" disabled={busy !== null || !permitted} title={!permitted ? "Equal or higher roles cannot be moderated." : undefined} aria-label={(listener.muted ? "Unmute " : "Mute ") + (member?.displayName ?? "listener")} onClick={() => void moderate(listener, listener.muted ? "unmute" : "mute")}><AppIcon name={listener.muted ? "volume" : "volumeOff"} size="sm" /></button>
              <button type="button" className="danger" disabled={busy !== null || !permitted} title={!permitted ? "Equal or higher roles cannot be removed." : undefined} aria-label={"Remove " + (member?.displayName ?? "listener")} onClick={() => void moderate(listener, "remove")}><AppIcon name="close" size="sm" /></button>
              <button type="button" disabled={busy !== null || listener.userId === currentUser.userId} aria-label={"Report " + (member?.displayName ?? "listener")} onClick={() => void reportListener(listener)}><AppIcon name="inbox" size="sm" /></button>
            </div>;
          }) : <p>No active listener identities are visible to this host.</p>}
        </section>
      </aside>
    </div>

    {pendingTransition && selected ? <div className="radio-danger-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="radio-transition-title"><div><AppIcon name="close" size="lg" /><span><strong id="radio-transition-title">{pendingTransition === "ended" ? "End this live broadcast?" : "Cancel this scheduled broadcast?"}</strong><p>This action is recorded in the community audit log and cannot be reversed.</p></span></div><footer><button type="button" onClick={() => setPendingTransition(null)}>Keep session</button><button type="button" className="danger" disabled={busy !== null} onClick={() => void transition(pendingTransition)}>{pendingTransition === "ended" ? "Confirm end" : "Confirm cancel"}</button></footer></div> : null}
  </section>;
}
