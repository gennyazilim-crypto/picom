import { useEffect, useState } from "react";
import type { RadioSession } from "../../types/audio";
import type { Member } from "../../types/community";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { radioService } from "../../services/audio/radioService";
import { useAudioCatalog } from "../../hooks/useAudioCatalog";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { audioPlayerService } from "../../services/audio/audioPlayerService";
import "./RadioPanel.css";

type RadioPanelProps = {
  session: RadioSession;
  communityName: string;
  host?: Member;
  listeners: Member[];
  canHost: boolean;
  onClose: () => void;
  onOpenCommunity: () => void;
};

function radioStatusLabel(status: RadioSession["status"]) {
  if (status === "live") return "Live now";
  if (status === "scheduled") return "Scheduled";
  if (status === "draft") return "Draft";
  if (status === "cancelled") return "Cancelled";
  return "Ended";
}

export function RadioNowLiveHeader({ session, communityName, onClose }: { session: RadioSession; communityName: string; onClose: () => void }) {
  return (
    <header className="radio-now-live-header">
      <div className="radio-panel-cover" aria-hidden="true">
        {session.coverUrl ? <img src={session.coverUrl} alt="" /> : <AppIcon name="headphones" size="xl" />}
      </div>
      <div className="radio-panel-title">
        <div className="radio-panel-hero-top">
          <span className={`radio-status ${session.status}`}>
            <i aria-hidden="true" />
            {radioStatusLabel(session.status)}
          </span>
          <small>{communityName}</small>
        </div>
        <h1>{session.title}</h1>
        <p>{session.description}</p>
        <div className="radio-panel-stat-row">
          <span className="radio-panel-stat">
            <AppIcon name="eye" size="xs" aria-hidden="true" />
            <strong>{session.listenerCount}</strong>
            listeners
          </span>
          <span className="radio-panel-stat">
            <AppIcon name="users" size="xs" aria-hidden="true" />
            <strong>{session.speakerCount}</strong>
            speakers
          </span>
        </div>
      </div>
      <button type="button" className="icon-button radio-panel-close" aria-label="Close radio panel" onClick={onClose}>
        <AppIcon name="close" size="md" />
      </button>
    </header>
  );
}

export function RadioHostCard({ host }: { host?: Member }) {
  return (
    <section className="radio-host-card">
      <span className="radio-panel-section-icon" aria-hidden="true">
        <AppIcon name="microphone" size="md" />
      </span>
      {host ? <MemberAvatar member={host} size={44} /> : null}
      <div>
        <small>Hosted by</small>
        <strong>{host?.displayName ?? "Picom host"}</strong>
        <span>{host?.statusText ?? "Community radio host"}</span>
      </div>
    </section>
  );
}

export function RadioListenerList({ listeners, total }: { listeners: Member[]; total: number }) {
  return (
    <section className="radio-listener-card">
      <header>
        <div>
          <small>Listeners</small>
          <strong>In the room</strong>
        </div>
        <span>{total}</span>
      </header>
      <div className="radio-listener-list">
        {listeners.slice(0, 6).map((listener) => (
          <div key={listener.userId}>
            <MemberAvatar member={listener} size={30} />
            <span>
              <strong>{listener.displayName}</strong>
              <small>{listener.statusText ?? listener.status}</small>
            </span>
          </div>
        ))}
        {total > listeners.length ? <p>+{total - listeners.length} listening privately</p> : null}
      </div>
    </section>
  );
}

type RadioControlsProps = {
  status: RadioSession["status"];
  listening: boolean;
  muted: boolean;
  volume: number;
  saved: boolean;
  onToggleListening: () => void;
  onToggleMuted: () => void;
  onVolumeChange: (value: number) => void;
  onToggleSaved: () => void;
  onShare: () => void;
  busy?: boolean;
};

export function RadioControls({
  status,
  listening,
  muted,
  volume,
  saved,
  onToggleListening,
  onToggleMuted,
  onVolumeChange,
  onToggleSaved,
  onShare,
  busy = false,
}: RadioControlsProps) {
  const unavailable = status !== "live";
  const listenLabel = listening
    ? "Stop listening"
    : status === "scheduled"
      ? "Not live yet"
      : status === "ended"
        ? "Broadcast ended"
        : "Listen live";

  return (
    <section className="radio-controls" aria-label="Radio controls">
      <div className="radio-controls-start">
        <button type="button" className="primary-button" disabled={unavailable || busy} onClick={onToggleListening}>
          <AppIcon name={listening ? "pause" : "play"} size="md" />
          {listenLabel}
        </button>
        <div className="radio-panel-volume">
          <button
            type="button"
            className={`icon-button ${muted ? "active" : ""}`}
            disabled={!listening}
            aria-label={muted ? "Unmute radio" : "Mute radio"}
            onClick={onToggleMuted}
          >
            <AppIcon name={muted ? "volumeOff" : "volume"} size="md" />
          </button>
          <label>
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              disabled={!listening}
              aria-label="Radio volume"
              onChange={(event) => onVolumeChange(Number(event.target.value))}
            />
          </label>
        </div>
      </div>
      <div className="radio-controls-end">
        <button
          type="button"
          className={`radio-panel-icon-action ${saved ? "active" : ""}`}
          disabled={busy}
          aria-label={saved ? "Remove saved radio" : "Save radio"}
          title={saved ? "Saved" : "Save"}
          onClick={onToggleSaved}
        >
          <AppIcon name="pin" size="md" />
        </button>
        <button type="button" className="radio-panel-icon-action" aria-label="Share radio session" title="Share" onClick={onShare}>
          <AppIcon name="more" size="md" />
        </button>
      </div>
    </section>
  );
}

export function RadioScheduleCard({ session }: { session: RadioSession }) {
  const startsAt = new Date(session.startsAt);
  const label = session.status === "scheduled" ? "Starts" : session.status === "ended" ? "Aired" : "Started";
  return (
    <section className="radio-schedule-card">
      <span aria-hidden="true">
        <AppIcon name="bell" size="md" />
      </span>
      <div>
        <small>{label}</small>
        <strong>{startsAt.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</strong>
        <p>{startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </section>
  );
}

export function RadioChatLink({ communityName, onOpenCommunity }: { communityName: string; onOpenCommunity: () => void }) {
  return (
    <button type="button" className="radio-chat-link" onClick={onOpenCommunity}>
      <span aria-hidden="true">
        <AppIcon name="hash" size="md" />
      </span>
      <span>
        <small>Community conversation</small>
        <strong>Open {communityName}</strong>
      </span>
      <AppIcon name="chevronRight" size="sm" />
    </button>
  );
}

export function RadioPanel({ session, communityName, host, listeners, canHost, onClose, onOpenCommunity }: RadioPanelProps) {
  const catalog = useAudioCatalog();
  const [activeSession, setActiveSession] = useState(session);
  const player = useAudioPlayer();
  const listening = player.item?.id === activeSession.id && !["idle", "ended", "error"].includes(player.status);
  const [saved, setSaved] = useState(session.isSavedByCurrentUser);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"status" | "error">("status");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<"ended" | "cancelled" | null>(null);

  useEffect(() => {
    setActiveSession(session);
    setSaved(session.isSavedByCurrentUser);
  }, [session]);

  useEffect(() => {
    const current = catalog.radioSessions.find((item) => item.id === activeSession.id);
    if (current) {
      setActiveSession(current);
      setSaved(current.isSavedByCurrentUser);
    }
  }, [activeSession.id, catalog.radioSessions]);

  useEffect(() => {
    if (player.item?.id === activeSession.id && ["ended", "cancelled"].includes(activeSession.status)) {
      audioPlayerService.markEnded(activeSession.status === "cancelled" ? "This broadcast was cancelled." : "This broadcast has ended.");
    }
  }, [activeSession.id, activeSession.status, player.item?.id]);

  const runAction = async (name: string, action: () => Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>, success: string) => {
    setBusyAction(name);
    setNotice(null);
    const result = await action();
    setBusyAction(null);
    if (!result.ok) {
      setNoticeTone("error");
      setNotice(result.error?.message ?? "The Radio action could not be completed.");
      return result;
    }
    setNoticeTone("status");
    setNotice(success);
    return result;
  };

  const toggleListening = async () => {
    const next = !listening;
    await runAction(
      "listen",
      () => (next ? radioService.listenToRadio(activeSession.id) : radioService.leaveRadio(activeSession.id)),
      next ? "Listening live." : "Left the live audience.",
    );
  };

  const toggleSaved = async () => {
    const next = !saved;
    const result = await runAction(
      "save",
      () => (next ? radioService.saveRadio(activeSession.id) : radioService.unsaveRadio(activeSession.id)),
      next ? "Radio session saved." : "Radio session removed from saved audio.",
    );
    if (result.ok) setSaved(next);
  };

  const changeStatus = async (next: "live" | "ended" | "cancelled") => {
    const result = await runAction(
      next,
      () =>
        next === "live"
          ? radioService.goLive(activeSession.id)
          : next === "ended"
            ? radioService.endRadioSession(activeSession.id)
            : radioService.cancelRadioSchedule(activeSession.id),
      next === "live" ? "Broadcast is live." : next === "ended" ? "Broadcast ended." : "Schedule cancelled.",
    );
    setConfirmStatus(null);
    if (result.ok && result.data) setActiveSession(result.data as RadioSession);
  };

  return (
    <main className="radio-panel">
      <RadioNowLiveHeader session={activeSession} communityName={communityName} onClose={onClose} />
      <div className="radio-panel-scroll">
        <RadioControls
          status={activeSession.status}
          listening={listening}
          muted={player.muted}
          volume={Math.round(player.volume * 100)}
          saved={saved}
          busy={busyAction !== null}
          onToggleListening={() => void toggleListening()}
          onToggleMuted={audioPlayerService.toggleMuted}
          onVolumeChange={(value) => audioPlayerService.setVolume(value / 100)}
          onToggleSaved={() => void toggleSaved()}
          onShare={() => {
            setNoticeTone("status");
            setNotice("Sharing remains limited to authorized community routing.");
          }}
        />
        {notice ? (
          <div className="radio-panel-notice" role={noticeTone === "error" ? "alert" : "status"}>
            {notice}
          </div>
        ) : null}
        <div className="radio-panel-grid">
          <div className="radio-panel-primary">
            <RadioHostCard host={host} />
            <RadioScheduleCard session={activeSession} />
            <RadioChatLink communityName={communityName} onOpenCommunity={onOpenCommunity} />
            {canHost ? (
              <section className="radio-host-actions">
                <header>
                  <small>Host tools</small>
                  <strong>Broadcast controls</strong>
                </header>
                <div>
                  <button type="button" disabled={busyAction !== null || !["draft", "scheduled"].includes(activeSession.status)} onClick={() => void changeStatus("live")}>
                    <AppIcon name="play" size="sm" />
                    Start broadcast
                  </button>
                  <button type="button" disabled={busyAction !== null || activeSession.status !== "live"} onClick={() => setConfirmStatus("ended")}>
                    <AppIcon name="close" size="sm" />
                    End broadcast
                  </button>
                  <button type="button" disabled={busyAction !== null || !["draft", "scheduled"].includes(activeSession.status)} onClick={() => setConfirmStatus("cancelled")}>
                    <AppIcon name="bell" size="sm" />
                    Cancel schedule
                  </button>
                </div>
              </section>
            ) : null}
            {confirmStatus ? (
              <div className="radio-danger-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="radio-panel-confirm-title">
                <div className="radio-danger-confirmation-body">
                  <span className="radio-danger-confirmation-icon" aria-hidden="true">
                    <AppIcon name="close" size="lg" />
                  </span>
                  <span>
                    <strong id="radio-panel-confirm-title">{confirmStatus === "ended" ? "End this broadcast?" : "Cancel this schedule?"}</strong>
                    <p>This action is recorded and cannot be reversed.</p>
                  </span>
                </div>
                <footer>
                  <button type="button" onClick={() => setConfirmStatus(null)}>
                    Keep session
                  </button>
                  <button type="button" className="danger" disabled={busyAction !== null} onClick={() => void changeStatus(confirmStatus)}>
                    {confirmStatus === "ended" ? "Confirm end" : "Confirm cancel"}
                  </button>
                </footer>
              </div>
            ) : null}
          </div>
          <RadioListenerList listeners={listeners} total={activeSession.listenerCount} />
        </div>
      </div>
    </main>
  );
}
