import { useMemo, useState } from "react";
import type { AudioPlayableItem, RadioSession } from "../../types/audio";
import type { Member } from "../../types/community";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { AudioMiniPlayer } from "./AudioMiniPlayer";

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
  return "Ended";
}

function radioPlayable(session: RadioSession, communityName: string): AudioPlayableItem {
  return {
    id: session.id,
    type: session.status === "scheduled" ? "radio_scheduled" : "radio_live",
    title: session.title,
    contextLabel: `${communityName} / Radio`,
    coverUrl: session.coverUrl,
    durationSeconds: 3600,
  };
}

export function RadioNowLiveHeader({ session, communityName, onClose }: { session: RadioSession; communityName: string; onClose: () => void }) {
  return <header className="radio-now-live-header">
    <div className="radio-panel-cover" aria-hidden="true">{session.coverUrl ? <img src={session.coverUrl} alt="" /> : <AppIcon name="headphones" size="xl" />}</div>
    <div className="radio-panel-title">
      <span className={`radio-status ${session.status}`}><i />{radioStatusLabel(session.status)}</span>
      <small>{communityName}</small>
      <h1>{session.title}</h1>
      <p>{session.description}</p>
      <div><span>{session.listenerCount} listeners</span><span>{session.speakerCount} speakers</span></div>
    </div>
    <button type="button" className="icon-button radio-panel-close" aria-label="Close radio panel" onClick={onClose}><AppIcon name="close" size="md" /></button>
  </header>;
}

export function RadioHostCard({ host }: { host?: Member }) {
  return <section className="radio-host-card">
    <span className="radio-panel-section-icon" aria-hidden="true"><AppIcon name="microphone" size="md" /></span>
    {host ? <MemberAvatar member={host} size={42} /> : null}
    <div><small>HOSTED BY</small><strong>{host?.displayName ?? "Picom host"}</strong><span>{host?.statusText ?? "Community radio host"}</span></div>
  </section>;
}

export function RadioListenerList({ listeners, total }: { listeners: Member[]; total: number }) {
  return <section className="radio-listener-card">
    <header><div><small>LISTENERS</small><strong>In the room</strong></div><span>{total}</span></header>
    <div className="radio-listener-list">
      {listeners.slice(0, 6).map((listener) => <div key={listener.userId}><MemberAvatar member={listener} size={30} /><span><strong>{listener.displayName}</strong><small>{listener.statusText ?? listener.status}</small></span></div>)}
      {total > listeners.length ? <p>+{total - listeners.length} listening privately</p> : null}
    </div>
  </section>;
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
};

export function RadioControls({ status, listening, muted, volume, saved, onToggleListening, onToggleMuted, onVolumeChange, onToggleSaved, onShare }: RadioControlsProps) {
  const unavailable = status !== "live";
  return <section className="radio-controls" aria-label="Radio controls">
    <button type="button" className="primary-button" disabled={unavailable} onClick={onToggleListening}><AppIcon name={listening ? "pause" : "play"} size="md" />{listening ? "Stop listening" : status === "scheduled" ? "Not live yet" : status === "ended" ? "Broadcast ended" : "Listen live"}</button>
    <button type="button" className={`icon-button ${muted ? "active" : ""}`} disabled={!listening} aria-label={muted ? "Unmute radio" : "Mute radio"} onClick={onToggleMuted}><AppIcon name={muted ? "volumeOff" : "volume"} size="md" /></button>
    <label><span>Volume</span><input type="range" min="0" max="100" value={volume} disabled={!listening} aria-label="Radio volume" onChange={(event) => onVolumeChange(Number(event.target.value))} /></label>
    <button type="button" className={`secondary-button compact ${saved ? "active" : ""}`} onClick={onToggleSaved}><AppIcon name="pin" size="sm" />{saved ? "Saved" : "Save"}</button>
    <button type="button" className="secondary-button compact" onClick={onShare}><AppIcon name="more" size="sm" />Share</button>
  </section>;
}

export function RadioScheduleCard({ session }: { session: RadioSession }) {
  const startsAt = new Date(session.startsAt);
  return <section className="radio-schedule-card">
    <span aria-hidden="true"><AppIcon name="bell" size="md" /></span>
    <div><small>{session.status === "scheduled" ? "STARTS" : session.status === "ended" ? "AIRED" : "STARTED"}</small><strong>{startsAt.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</strong><p>{startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>
  </section>;
}

export function RadioChatLink({ communityName, onOpenCommunity }: { communityName: string; onOpenCommunity: () => void }) {
  return <button type="button" className="radio-chat-link" onClick={onOpenCommunity}><span aria-hidden="true"><AppIcon name="hash" size="md" /></span><span><small>COMMUNITY CONVERSATION</small><strong>Open {communityName}</strong></span><AppIcon name="chevronRight" size="sm" /></button>;
}

export function RadioPanel({ session, communityName, host, listeners, canHost, onClose, onOpenCommunity }: RadioPanelProps) {
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(72);
  const [saved, setSaved] = useState(session.isSavedByCurrentUser);
  const [notice, setNotice] = useState<string | null>(null);
  const playable = useMemo(() => radioPlayable(session, communityName), [communityName, session]);
  const hostAction = (label: string) => setNotice(`${label} is prepared for the future realtime radio service.`);

  return <main className="radio-panel">
    <RadioNowLiveHeader session={session} communityName={communityName} onClose={onClose} />
    <div className="radio-panel-scroll">
      <RadioControls status={session.status} listening={listening} muted={muted} volume={volume} saved={saved} onToggleListening={() => { setListening((current) => !current); setNotice(null); }} onToggleMuted={() => setMuted((current) => !current)} onVolumeChange={setVolume} onToggleSaved={() => setSaved((current) => !current)} onShare={() => setNotice("A safe share action is prepared; no private link was copied.")} />
      {notice ? <div className="radio-panel-notice" role="status">{notice}</div> : null}
      {listening ? <AudioMiniPlayer item={playable} onClose={() => setListening(false)} /> : null}
      <div className="radio-panel-grid">
        <div className="radio-panel-primary">
          <RadioHostCard host={host} />
          <RadioScheduleCard session={session} />
          <RadioChatLink communityName={communityName} onOpenCommunity={onOpenCommunity} />
          {canHost ? <section className="radio-host-actions"><header><small>HOST TOOLS</small><strong>Broadcast controls</strong></header><div>
            <button type="button" disabled={session.status === "live"} onClick={() => hostAction("Start broadcast")}><AppIcon name="play" size="sm" />Start broadcast</button>
            <button type="button" disabled={session.status !== "live"} onClick={() => hostAction("End broadcast")}><AppIcon name="close" size="sm" />End broadcast</button>
            <button type="button" onClick={() => hostAction("Manage listeners")}><AppIcon name="users" size="sm" />Manage listeners</button>
            <button type="button" onClick={() => hostAction("Schedule radio")}><AppIcon name="bell" size="sm" />Schedule radio</button>
          </div></section> : null}
        </div>
        <RadioListenerList listeners={listeners} total={session.listenerCount} />
      </div>
    </div>
  </main>;
}
