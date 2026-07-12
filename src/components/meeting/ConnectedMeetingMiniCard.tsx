import { useState, useSyncExternalStore } from "react";
import { meetingControlService, type MeetingControlResult } from "../../services/meeting/meetingControlService";
import { meetingService } from "../../services/meeting/meetingService";
import { AppIcon } from "../AppIcon";
import "./ConnectedMeetingMiniCard.css";

function experienceLabel(snapshot: ReturnType<typeof meetingService.store.getSnapshot>): string {
  if (snapshot.context?.roomMode === "stage") return "Live stage";
  if (snapshot.localMedia.screenSharing || (snapshot.screenShares?.length ?? 0) > 0) return "Screen sharing";
  if (snapshot.localMedia.cameraEnabled || snapshot.participantIds.some((id) => snapshot.participantsById[id]?.cameraEnabled)) return "Camera meeting";
  return "Voice meeting";
}

export function ConnectedMeetingMiniCard({ onReturn, onLeave }: { onReturn: () => void; onLeave: () => void }) {
  const snapshot = useSyncExternalStore(meetingService.store.subscribe, meetingService.store.getSnapshot, meetingService.store.getSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const terminal = snapshot.phase === "ended" || snapshot.phase === "failed" || snapshot.phase === "disconnected";
  const connected = snapshot.phase === "connected" || snapshot.phase === "reconnecting";
  const sharing = snapshot.localMedia.screenSharing || (snapshot.screenShares?.length ?? 0) > 0;
  const run = async (key: string, operation: () => MeetingControlResult | Promise<MeetingControlResult>) => { setBusy(key); setError(""); const result = await operation(); if (!result.ok) setError(result.error.message); setBusy(null); };

  if (!snapshot.context) return null;
  return <aside className={`connected-meeting-mini${terminal ? " is-terminal" : ""}`} aria-label="Connected meeting controls">
    <button type="button" className="connected-meeting-mini__return" onClick={onReturn} aria-label={`Return to ${snapshot.context.roomTitle}`}>
      <span className="connected-meeting-mini__mark"><AppIcon name={snapshot.context.roomMode === "stage" ? "voice" : sharing ? "image" : "users"} size="md" /></span>
      <span><small>{experienceLabel(snapshot)}</small><strong>{snapshot.context.roomTitle}</strong><em>{snapshot.context.communityName ?? "Picom"}</em></span>
      <AppIcon name="chevronRight" size="sm" />
    </button>
    <div className="connected-meeting-mini__status" role="status" aria-live="polite"><span className={`is-${snapshot.phase}`} aria-hidden="true" />{snapshot.phase === "reconnecting" ? "Reconnecting" : snapshot.phase === "failed" ? "Connection failed" : snapshot.phase === "disconnected" ? "Disconnected" : snapshot.phase === "ended" ? "Meeting ended" : "Connected"}<b>{snapshot.participantIds.length} people</b></div>
    {!terminal ? <div className="connected-meeting-mini__states"><span><AppIcon name={snapshot.localMedia.muted ? "volumeOff" : "microphone"} size="xs" />{snapshot.localMedia.muted ? "Muted" : "Mic on"}</span>{snapshot.capabilities.canPublishVideo ? <span><AppIcon name="eye" size="xs" />{snapshot.localMedia.cameraEnabled ? "Camera on" : "Camera off"}</span> : null}{snapshot.capabilities.canPublishAudio ? <span><AppIcon name="lock" size="xs" />Noise {snapshot.noiseShield.status}</span> : null}{sharing ? <span><AppIcon name="image" size="xs" />Sharing</span> : null}</div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {connected ? <div className="connected-meeting-mini__controls">
      {snapshot.capabilities.canPublishAudio ? <button type="button" disabled={busy !== null} aria-label={snapshot.localMedia.muted ? "Unmute meeting microphone" : "Mute meeting microphone"} aria-pressed={snapshot.localMedia.muted} onClick={() => void run("mute", () => meetingControlService.setMuted(!snapshot.localMedia.muted))}><AppIcon name={snapshot.localMedia.muted ? "volumeOff" : "microphone"} size="sm" /></button> : null}
      <button type="button" disabled={busy !== null} aria-label={snapshot.localMedia.deafened ? "Restore meeting audio" : "Deafen meeting audio"} aria-pressed={snapshot.localMedia.deafened} onClick={() => void run("deafen", () => meetingControlService.setDeafened(!snapshot.localMedia.deafened))}><AppIcon name="headphones" size="sm" /></button>
      {snapshot.capabilities.canPublishVideo ? <button type="button" disabled={busy !== null} aria-label={snapshot.localMedia.cameraEnabled ? "Turn meeting camera off" : "Turn meeting camera on"} aria-pressed={snapshot.localMedia.cameraEnabled} onClick={() => void run("camera", () => meetingControlService.setCameraEnabled(!snapshot.localMedia.cameraEnabled))}><AppIcon name="eye" size="sm" /></button> : null}
      {snapshot.capabilities.canPublishAudio ? <button type="button" disabled={busy !== null} aria-label={snapshot.noiseShield.status === "applied" ? "Turn Noise Shield off" : "Turn Noise Shield on"} aria-pressed={snapshot.noiseShield.status === "applied"} onClick={() => void run("noise", () => meetingControlService.setNoiseShield(snapshot.noiseShield.status !== "applied"))}><AppIcon name="lock" size="sm" /></button> : null}
      {snapshot.capabilities.canShareScreen || sharing ? <button type="button" aria-label={sharing ? "Return to active screen share" : "Open screen share controls"} aria-pressed={sharing} onClick={onReturn}><AppIcon name="image" size="sm" /></button> : null}
      <button type="button" className="is-leave" disabled={busy !== null} aria-label="Leave meeting" onClick={onLeave}><AppIcon name="close" size="sm" /></button>
    </div> : <div className="connected-meeting-mini__terminal"><button type="button" onClick={onReturn}>Open details</button><button type="button" className="is-leave" onClick={onLeave}>Dismiss</button></div>}
  </aside>;
}
