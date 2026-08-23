import { useEffect, useRef, useState } from "react";
import type { DmCall, DmCallRuntimeState, DmCallType, DmCallVideoTrack } from "../../types/dmCalls";
import { dateTimeService } from "../../services/dateTimeService";
import { meetingPreJoinService } from "../../services/meeting/meetingPreJoinService";
import { VoiceDevicePanel } from "../VoiceDevicePanel";
import { AppIcon } from "../AppIcon";
import { UserAvatar } from "../UserAvatar";
import { useProfileDisplayName } from "../ProfileDisplayName";
import "./DmCallInformation.css";

export type DmCallPeer = Readonly<{ id: string; name: string; avatarUrl?: string }>;

function useLivePeer(peer: DmCallPeer): DmCallPeer {
  const name = useProfileDisplayName(peer.id, peer.name);
  return { ...peer, name };
}

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

function CallAvatar({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl?: string }) {
  const displayName = useProfileDisplayName(userId, name);
  return (
    <UserAvatar
      userId={userId}
      displayName={displayName}
      fallbackUrl={avatarUrl}
      size={28}
      className="dm-call-avatar"
      alt={displayName + " profile photo"}
    />
  );
}

function DmCallVideoTile({ track }: { track: DmCallVideoTrack }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = track.stream;
    void video.play().catch(() => undefined);
    return () => {
      if (video.srcObject === track.stream) video.srcObject = null;
    };
  }, [track.stream]);
  return (
    <article className="dm-call-video-tile">
      <video ref={videoRef} autoPlay playsInline muted={track.isLocal} aria-label={`${track.isLocal ? "Your" : track.participantName + "'s"} camera`} />
      <span>{track.isLocal ? "You" : track.participantName}</span>
    </article>
  );
}

export function DmCallVideoStage({ currentUserId, peer, runtime }: { currentUserId: string; peer: DmCallPeer; runtime: DmCallRuntimeState }) {
  const tracks = runtime.cameraTracks ?? [];
  const localTrack = tracks.find((track) => track.isLocal);
  const remoteTrack = tracks.find((track) => !track.isLocal);
  return (
    <section className="dm-call-video-stage" aria-label="Video call cameras">
      {localTrack ? <DmCallVideoTile track={localTrack} /> : (
        <article className="dm-call-video-tile is-camera-off">
          <CallAvatar userId={currentUserId} name="You" />
          <span>You / Camera off</span>
        </article>
      )}
      {remoteTrack ? <DmCallVideoTile track={remoteTrack} /> : (
        <article className="dm-call-video-tile is-camera-off">
          <CallAvatar userId={peer.id} name={peer.name} avatarUrl={peer.avatarUrl} />
          <span>{peer.name} / Camera off</span>
        </article>
      )}
    </section>
  );
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
  const livePeer = useLivePeer(peer);
  const live = Boolean(call && !terminalStatuses.has(call.status));
  const duration = useAuthoritativeDuration(call);
  if (!live || !call) {
    return (
      <div className="dm-call-header-controls" aria-label={`Call ${livePeer.name}`}>
        <button className="icon-button" type="button" aria-label={`Start a voice call with ${livePeer.name}`} title="Start voice call" onClick={() => onStart("voice")}><AppIcon name="phone" size="sm" /></button>
        <button className="icon-button" type="button" aria-label={`Start a video call with ${livePeer.name}`} title="Start video call" onClick={() => onStart("video")}><AppIcon name="camera" size="sm" /></button>
        <button className="icon-button" type="button" aria-label={`Start screen sharing with ${livePeer.name}`} title="Start screen share" onClick={() => onStart("video", true)}><AppIcon name="maximize" size="sm" /></button>
      </div>
    );
  }
  const canJoin = !runtime.connected && (call.status !== "ringing" || call.createdBy === peer.id);
  return (
    <div className="dm-call-header-controls is-active">
      <span className="dm-call-header-status" role="status"><i />{call.callType === "video" ? "Video" : "Voice"} / {formatDuration(duration)} / {Math.max(runtime.participantCount, call.participants.filter((participant) => participant.finalStatus === "connected").length)} connected</span>
      {canJoin ? <button type="button" className="dm-call-join" onClick={onJoin}>{call.status === "ringing" ? "Join" : "Rejoin"}</button> : null}
      <button className={`icon-button ${runtime.muted ? "is-off" : ""}`} type="button" aria-label={runtime.muted ? "Unmute microphone" : "Mute microphone"} title={runtime.muted ? "Unmute" : "Mute"} disabled={!runtime.connected} onClick={onToggleMute}><AppIcon name="microphone" size="sm" /></button>
      <button className={`icon-button ${runtime.cameraEnabled ? "active" : ""}`} type="button" aria-label={runtime.cameraEnabled ? "Turn camera off" : "Turn camera on"} title="Camera" disabled={!runtime.connected} onClick={onToggleCamera}><AppIcon name="camera" size="sm" /></button>
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
  onEnd: () => void;
}>;

function activeCardHeadline(call: DmCall, peerName: string, currentUserId: string, runtime: DmCallRuntimeState): string {
  if (runtime.reconnecting) return "Reconnecting…";
  if (call.status === "ringing") {
    return call.createdBy === currentUserId ? `Calling ${peerName}` : `${peerName} is calling`;
  }
  return `In call with ${peerName}`;
}

function activeCardActionLabel(call: DmCall, runtime: DmCallRuntimeState): string {
  if (runtime.connected) return "Return to call";
  if (call.status === "ringing") return "Join call";
  return "Rejoin call";
}

export function DmCallInformationCard({ call, currentUserId, peer, runtime, onJoin, onReturn, onEnd }: ActiveCardProps) {
  const livePeer = useLivePeer(peer);
  const duration = useAuthoritativeDuration(call);
  const connected = call.participants.filter(
    (participant) => participant.finalStatus === "connected" || participant.finalStatus === "reconnecting",
  );
  const peerParticipant = call.participants.find((participant) => participant.userId !== currentUserId);
  const mutedCount = call.participants.filter((participant) => !participant.microphoneEnabled).length;
  const cameraOn = call.participants.some((participant) => participant.cameraEnabled) || runtime.cameraEnabled;
  const screenSharing = call.screenShareUsed || runtime.screenSharing;
  const isRinging = call.status === "ringing";
  const headline = activeCardHeadline(call, livePeer.name, currentUserId, runtime);
  const actionLabel = activeCardActionLabel(call, runtime);
  const openCall = runtime.connected ? onReturn : onJoin;
  const callKind = `${call.createdBy === currentUserId ? "Outgoing" : "Incoming"} ${call.callType}`;
  const endLabel = isRinging && call.createdBy === currentUserId ? "Cancel" : "End call";
  const showPrimaryAction = !(isRinging && call.createdBy === currentUserId);

  return (
    <article
      className={`dm-call-information-card${isRinging ? " is-ringing" : ""}${runtime.reconnecting ? " is-reconnecting" : ""}`}
      aria-label={`${call.callType} call information`}
    >
      <div className="dm-call-information-body">
        <span className={`dm-call-information-icon${isRinging ? " is-pulse" : ""}`} aria-hidden="true">
          <AppIcon name={call.callType === "video" ? "camera" : "phone"} size="md" />
        </span>
        <div className="dm-call-information-copy">
          <strong>{headline}</strong>
          <div className="dm-call-information-meta" aria-label="Call status">
            <span>{callKind}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(duration)}</span>
            <span aria-hidden="true">·</span>
            <span className={`dm-call-quality quality-${runtime.quality}`}>{qualityLabel(runtime)}</span>
            {runtime.activeSpeakerName ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{runtime.activeSpeakerName} speaking</span>
              </>
            ) : null}
          </div>
          {(mutedCount > 0 || cameraOn || screenSharing || runtime.reconnecting) ? (
            <div className="dm-call-information-flags" aria-label="Call details">
              {runtime.reconnecting ? <span className="is-warn">Reconnecting</span> : null}
              {mutedCount > 0 ? (
                <span>
                  <AppIcon name="microphone" size="xs" />
                  {mutedCount === 1 && peerParticipant && !peerParticipant.microphoneEnabled
                    ? `${livePeer.name} muted`
                    : `${mutedCount} muted`}
                </span>
              ) : null}
              {cameraOn ? (
                <span>
                  <AppIcon name="camera" size="xs" />
                  Camera on
                </span>
              ) : null}
              {screenSharing ? (
                <span>
                  <AppIcon name="maximize" size="xs" />
                  Screen sharing
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="dm-call-participant-stack"
          aria-label={`${Math.max(runtime.participantCount, connected.length)} participants`}
        >
          {call.participants.map((participant) => (
            <CallAvatar
              key={participant.userId}
              userId={participant.userId}
              name={participant.userId === currentUserId ? "You" : participant.displayName}
              avatarUrl={participant.avatarUrl}
            />
          ))}
        </div>
      </div>
      <div className="dm-call-information-actions">
        {showPrimaryAction ? (
          <button type="button" className="dm-call-information-action" onClick={openCall}>
            <AppIcon name={runtime.connected ? "voice" : "phone"} size="sm" />
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="dm-call-information-end"
          onClick={onEnd}
          aria-label={endLabel}
          title={endLabel}
        >
          <AppIcon name="close" size="sm" />
          {endLabel}
        </button>
      </div>
    </article>
  );
}

export function DmCallTimelineEvent({ call, currentUserId, peer, onCallBack, onMarkRead, onDismiss }: { call: DmCall; currentUserId: string; peer: DmCallPeer; onCallBack: (type: DmCallType) => void; onMarkRead: () => void; onDismiss: () => Promise<boolean> }) {
  const livePeer = useLivePeer(peer);
  const outgoing = call.createdBy === currentUserId;
  const [removing, setRemoving] = useState(false);
  const dismiss = async () => {
    if (removing) return;
    setRemoving(true);
    const removed = await onDismiss();
    if (!removed) setRemoving(false);
  };
  return (
    <article className={`dm-call-timeline-event status-${call.status}${call.unread ? " is-unread" : ""}`} onClick={call.unread ? onMarkRead : undefined}>
      <span className="dm-call-timeline-icon"><AppIcon name={call.callType === "video" ? "camera" : "phone"} size="md" /></span>
      <div className="dm-call-timeline-copy"><strong>{callTitle(call)}</strong><span>{outgoing ? `You called ${livePeer.name}` : `${livePeer.name} called you`} / {dateTimeService.formatFullTimestamp(call.startedAt)}</span><small>{call.endedAt ? `${formatDuration(call.durationSeconds)}${call.screenShareUsed ? " / screen shared" : ""}${call.participants.some((participant) => participant.reconnectCount > 0) ? ` / ${call.participants.reduce((total, participant) => total + participant.reconnectCount, 0)} reconnects` : ""}` : "Waiting for participants"}</small></div>
      <div className="dm-call-timeline-actions">
        <button type="button" aria-label={`Call ${livePeer.name} back`} onClick={(event) => { event.stopPropagation(); onCallBack(call.callType); }}><AppIcon name="phone" size="sm" />Call back</button>
        <button type="button" className="dm-call-timeline-remove" disabled={removing} aria-label="Remove call from history" title="Remove from call history" onClick={(event) => { event.stopPropagation(); void dismiss(); }}><AppIcon name="close" size="xs" /></button>
      </div>
    </article>
  );
}

export function DmActiveCallMiniPanel({ call, currentUserId, peer, runtime, onReturn, onToggleMute, onToggleSpeaker, onToggleCamera, onScreenShare, onEnd }: { call: DmCall; currentUserId: string; peer: DmCallPeer; runtime: DmCallRuntimeState; onReturn: () => void; onToggleMute: () => void; onToggleSpeaker: () => void; onToggleCamera: () => void; onScreenShare: () => void; onEnd: () => void }) {
  const livePeer = useLivePeer(peer);
  const duration = useAuthoritativeDuration(call);
  const headline = activeCardHeadline(call, livePeer.name, currentUserId, runtime);
  const direction = call.createdBy === currentUserId ? "Outgoing" : "Incoming";
  return (
    <aside className="dm-active-call-mini" aria-label={`Active call with ${livePeer.name}`}>
      <button type="button" className="dm-active-call-copy" onClick={onReturn}><span className="dm-call-live-dot" /><div><strong>{headline}</strong><small>{direction} {call.callType} / {formatDuration(duration)} / {qualityLabel(runtime)}</small></div></button>
      <div className="dm-active-call-mini-controls">
        <button type="button" aria-label={runtime.muted ? "Unmute microphone" : "Mute microphone"} className={runtime.muted ? "is-off" : ""} onClick={onToggleMute}><AppIcon name="microphone" size="sm" /></button>
        <button type="button" aria-label={runtime.deafened ? "Unmute speakers" : "Mute speakers"} className={runtime.deafened ? "is-off" : ""} onClick={onToggleSpeaker}><AppIcon name="headphones" size="sm" /></button>
        <button type="button" aria-label={runtime.cameraEnabled ? "Turn camera off" : "Turn camera on"} className={runtime.cameraEnabled ? "active" : ""} onClick={onToggleCamera}><AppIcon name="camera" size="sm" /></button>
        <button type="button" aria-label={runtime.screenSharing ? "Stop screen share" : "Start screen share"} className={runtime.screenSharing ? "active" : ""} onClick={onScreenShare}><AppIcon name="maximize" size="sm" /></button>
        <button type="button" className="danger" aria-label="End call" onClick={onEnd}><AppIcon name="close" size="sm" /></button>
      </div>
    </aside>
  );
}
