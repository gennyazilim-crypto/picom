import { useEffect, useMemo, useState } from "react";
import type { DmCall, DmCallRuntimeState, DmCallType } from "../../types/dmCalls";
import { dateTimeService } from "../../services/dateTimeService";
import { meetingPreJoinService } from "../../services/meeting/meetingPreJoinService";
import { VoiceDevicePanel } from "../VoiceDevicePanel";
import { AppIcon } from "../AppIcon";
import "./DmCallInformation.css";

export type DmCallPeer = Readonly<{ id: string; name: string; avatarUrl?: string }>;

const terminalStatuses = new Set(["declined", "canceled", "missed", "busy", "failed", "completed"]);

function durationSeconds(call: DmCall, now: number): number {
  if (call.endedAt) return call.durationSeconds;
  const anchor = Date.parse(call.connectedAt ?? call.startedAt);
  return Number.isFinite(anchor) ? Math.max(0, Math.floor((now - anchor) / 1000)) : 0;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function useAuthoritativeDuration(call?: DmCall): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!call || call.endedAt || terminalStatuses.has(call.status)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [call?.endedAt, call?.status]);
  return call ? durationSeconds(call, now) : 0;
}

function CallAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return <span className="dm-call-avatar" aria-label={name}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <span aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>}</span>;
}

function callTitle(call: DmCall): string {
  if (call.status === "missed") return `Missed ${call.callType} call`;
  if (call.status === "declined") return `Declined ${call.callType} call`;
  if (call.status === "canceled") return `Canceled ${call.callType} call`;
  if (call.status === "busy") return `Busy ${call.callType} call`;
  if (call.status === "failed") return `Failed ${call.callType} call`;
  if (call.status === "completed") return `${call.callType === "video" ? "Video" : "Voice"} call ended`;
  return `${call.callType === "video" ? "Video" : "Voice"} call in progress`;
}

function qualityLabel(runtime: DmCallRuntimeState): string {
  if (runtime.reconnecting) return "Reconnecting";
  return runtime.quality === "unknown" ? "Measuring" : runtime.quality.slice(0, 1).toUpperCase() + runtime.quality.slice(1);
}

function DmCallDiagnostics({ call, runtime }: { call: DmCall; runtime: DmCallRuntimeState }) {
  return (
    <section className="dm-call-diagnostics" aria-label="Call diagnostics">
      <header><strong>Call diagnostics</strong><span className={`quality-${runtime.quality}`}>{qualityLabel(runtime)}</span></header>
      <dl>
        <div><dt>Call ID</dt><dd>{call.id.slice(0, 8)}</dd></div>
        <div><dt>Room</dt><dd>{call.livekitRoomName}</dd></div>
        <div><dt>Reconnects</dt><dd>{runtime.reconnectCount}</dd></div>
        <div><dt>Participants</dt><dd>{runtime.participantCount}</dd></div>
        <div><dt>Ping / jitter</dt><dd>Reported when transport stats are available</dd></div>
        <div><dt>Packet loss</dt><dd>Reported when transport stats are available</dd></div>
      </dl>
      <p>Picom never stores media, access tokens, IP addresses, or device identifiers in call diagnostics.</p>
    </section>
  );
}

function DmCallSettings({ call, runtime, onClose }: { call: DmCall; runtime: DmCallRuntimeState; onClose: () => void }) {
  const [cameraState, setCameraState] = useState(() => meetingPreJoinService.getSnapshot());
  useEffect(() => {
    const unsubscribe = meetingPreJoinService.subscribe(() => setCameraState(meetingPreJoinService.getSnapshot()));
    void meetingPreJoinService.refreshDevices();
    return () => { unsubscribe(); };
  }, []);
  return (
    <div className="dm-call-settings" role="dialog" aria-label="Call settings">
      <header><div><span>Live call</span><strong>Devices and quality</strong></div><button type="button" aria-label="Close call settings" onClick={onClose}><AppIcon name="close" size="sm" /></button></header>
      <VoiceDevicePanel />
      <label className="dm-call-camera-select">
        <span><AppIcon name="eye" size="sm" /> Camera</span>
        <select value={cameraState.selectedCameraId} disabled={cameraState.busy || !cameraState.cameras.length} onChange={(event) => void meetingPreJoinService.selectCamera(event.target.value)}>
          {!cameraState.cameras.length ? <option value="default">No camera available</option> : null}
          {cameraState.cameras.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}
        </select>
      </label>
      <DmCallDiagnostics call={call} runtime={runtime} />
    </div>
  );
}

type HeaderControlsProps = Readonly<{
  call?: DmCall;
  peer: DmCallPeer;
  runtime: DmCallRuntimeState;
  onStart: (type: DmCallType, screenShare?: boolean) => void;
  onJoin: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onScreenShare: () => void;
  onEnd: () => void;
}>;

export function DmCallHeaderControls({ call, peer, runtime, onStart, onJoin, onToggleMute, onToggleCamera, onScreenShare, onEnd }: HeaderControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const live = Boolean(call && !terminalStatuses.has(call.status));
  const duration = useAuthoritativeDuration(call);
  if (!live || !call) {
    return (
      <div className="dm-call-header-controls" aria-label={`Call ${peer.name}`}>
        <button className="icon-button" type="button" aria-label={`Start a voice call with ${peer.name}`} title="Start voice call" onClick={() => onStart("voice")}><AppIcon name="voice" size="sm" /></button>
        <button className="icon-button" type="button" aria-label={`Start a video call with ${peer.name}`} title="Start video call" onClick={() => onStart("video")}><AppIcon name="eye" size="sm" /></button>
        <button className="icon-button" type="button" aria-label={`Start screen sharing with ${peer.name}`} title="Start screen share" onClick={() => onStart("video", true)}><AppIcon name="maximize" size="sm" /></button>
      </div>
    );
  }
  return (
    <div className="dm-call-header-controls is-active">
      <span className="dm-call-header-status" role="status"><i />{call.callType === "video" ? "Video" : "Voice"} / {formatDuration(duration)} / {Math.max(runtime.participantCount, call.participants.filter((participant) => participant.finalStatus === "connected").length)} connected</span>
      {!runtime.connected ? <button type="button" className="dm-call-join" onClick={onJoin}>{call.status === "ringing" ? "Join" : "Rejoin"}</button> : null}
      <button className={`icon-button ${runtime.muted ? "is-off" : ""}`} type="button" aria-label={runtime.muted ? "Unmute microphone" : "Mute microphone"} title={runtime.muted ? "Unmute" : "Mute"} disabled={!runtime.connected} onClick={onToggleMute}><AppIcon name="microphone" size="sm" /></button>
      <button className={`icon-button ${runtime.cameraEnabled ? "active" : ""}`} type="button" aria-label={runtime.cameraEnabled ? "Turn camera off" : "Turn camera on"} title="Camera" disabled={!runtime.connected} onClick={onToggleCamera}><AppIcon name="eye" size="sm" /></button>
      <button className={`icon-button ${runtime.screenSharing ? "active" : ""}`} type="button" aria-label={runtime.screenSharing ? "Stop screen sharing" : "Start screen sharing"} title="Screen share" disabled={!runtime.connected} onClick={onScreenShare}><AppIcon name="maximize" size="sm" /></button>
      <button className="icon-button" type="button" aria-label="Open call settings" aria-expanded={settingsOpen} title="Call settings" onClick={() => setSettingsOpen((open) => !open)}><AppIcon name="settings" size="sm" /></button>
      <button className="icon-button dm-call-end" type="button" aria-label="End call" title="End call" onClick={onEnd}><AppIcon name="close" size="sm" /></button>
      {settingsOpen ? <DmCallSettings call={call} runtime={runtime} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}

type ActiveCardProps = Readonly<{
  call: DmCall;
  currentUserId: string;
  peer: DmCallPeer;
  runtime: DmCallRuntimeState;
  onJoin: () => void;
  onReturn: () => void;
}>;

export function DmCallInformationCard({ call, currentUserId, peer, runtime, onJoin, onReturn }: ActiveCardProps) {
  const duration = useAuthoritativeDuration(call);
  const connected = call.participants.filter((participant) => participant.finalStatus === "connected" || participant.finalStatus === "reconnecting");
  const activeSpeaker = runtime.activeSpeakerName;
  return (
    <article className="dm-call-information-card" aria-label={`${call.callType} call information`}>
      <div className="dm-call-information-main">
        <span className="dm-call-information-icon"><AppIcon name={call.callType === "video" ? "eye" : "voice"} size="lg" /></span>
        <div><span className="dm-call-eyebrow">{call.createdBy === currentUserId ? "Outgoing" : "Incoming"} {call.callType} call</span><strong>{call.status === "ringing" ? `Calling ${peer.name}` : "Call in progress"}</strong><small>{formatDuration(duration)} / {qualityLabel(runtime)}{activeSpeaker ? ` / ${activeSpeaker} speaking` : ""}</small></div>
      </div>
      <div className="dm-call-participant-stack" aria-label={`${connected.length || runtime.participantCount} connected participants`}>
        {call.participants.map((participant) => <CallAvatar key={participant.userId} name={participant.userId === currentUserId ? "You" : participant.displayName} avatarUrl={participant.avatarUrl} />)}
      </div>
      <div className="dm-call-information-states">
        <span><AppIcon name="users" size="xs" />{Math.max(runtime.participantCount, connected.length)} connected</span>
        <span><AppIcon name="microphone" size="xs" />{call.participants.filter((participant) => !participant.microphoneEnabled).length} muted</span>
        <span><AppIcon name="eye" size="xs" />{call.participants.filter((participant) => participant.cameraEnabled).length} camera</span>
        {call.screenShareUsed || runtime.screenSharing ? <span><AppIcon name="maximize" size="xs" />Screen sharing</span> : null}
      </div>
      <button type="button" className="dm-call-information-action" onClick={runtime.connected ? onReturn : onJoin}>{runtime.connected ? "Return to call" : call.status === "ringing" ? "Join call" : "Rejoin call"}</button>
    </article>
  );
}

export function DmCallTimelineEvent({ call, currentUserId, peer, onCallBack, onMarkRead }: { call: DmCall; currentUserId: string; peer: DmCallPeer; onCallBack: (type: DmCallType) => void; onMarkRead: () => void }) {
  const outgoing = call.createdBy === currentUserId;
  return (
    <article className={`dm-call-timeline-event status-${call.status}${call.unread ? " is-unread" : ""}`} onClick={call.unread ? onMarkRead : undefined}>
      <span className="dm-call-timeline-icon"><AppIcon name={call.callType === "video" ? "eye" : "voice"} size="md" /></span>
      <div><strong>{callTitle(call)}</strong><span>{outgoing ? `You called ${peer.name}` : `${peer.name} called you`} / {dateTimeService.formatFullTimestamp(call.startedAt)}</span><small>{call.endedAt ? `${formatDuration(call.durationSeconds)}${call.screenShareUsed ? " / screen shared" : ""}${call.participants.some((participant) => participant.reconnectCount > 0) ? ` / ${call.participants.reduce((total, participant) => total + participant.reconnectCount, 0)} reconnects` : ""}` : "Waiting for participants"}</small></div>
      <button type="button" aria-label={`Call ${peer.name} back`} onClick={(event) => { event.stopPropagation(); onCallBack(call.callType); }}><AppIcon name="voice" size="sm" />Call back</button>
    </article>
  );
}

export function DmActiveCallMiniPanel({ call, peer, runtime, onReturn, onToggleMute, onToggleSpeaker, onToggleCamera, onScreenShare, onEnd }: { call: DmCall; peer: DmCallPeer; runtime: DmCallRuntimeState; onReturn: () => void; onToggleMute: () => void; onToggleSpeaker: () => void; onToggleCamera: () => void; onScreenShare: () => void; onEnd: () => void }) {
  const duration = useAuthoritativeDuration(call);
  return (
    <aside className="dm-active-call-mini" aria-label={`Active call with ${peer.name}`}>
      <button type="button" className="dm-active-call-copy" onClick={onReturn}><span className="dm-call-live-dot" /><div><strong>{peer.name}</strong><small>{formatDuration(duration)} / {qualityLabel(runtime)}</small></div></button>
      <div className="dm-active-call-mini-controls">
        <button type="button" aria-label={runtime.muted ? "Unmute microphone" : "Mute microphone"} className={runtime.muted ? "is-off" : ""} onClick={onToggleMute}><AppIcon name="microphone" size="sm" /></button>
        <button type="button" aria-label={runtime.deafened ? "Unmute speakers" : "Mute speakers"} className={runtime.deafened ? "is-off" : ""} onClick={onToggleSpeaker}><AppIcon name="headphones" size="sm" /></button>
        <button type="button" aria-label={runtime.cameraEnabled ? "Turn camera off" : "Turn camera on"} className={runtime.cameraEnabled ? "active" : ""} onClick={onToggleCamera}><AppIcon name="eye" size="sm" /></button>
        <button type="button" aria-label={runtime.screenSharing ? "Stop screen share" : "Start screen share"} className={runtime.screenSharing ? "active" : ""} onClick={onScreenShare}><AppIcon name="maximize" size="sm" /></button>
        <button type="button" className="danger" aria-label="End call" onClick={onEnd}><AppIcon name="close" size="sm" /></button>
      </div>
    </aside>
  );
}
