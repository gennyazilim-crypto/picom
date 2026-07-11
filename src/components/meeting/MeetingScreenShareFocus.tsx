import { useEffect, useMemo, useRef, useState } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import type { MeetingClientParticipant, MeetingClientScreenShare, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import "./MeetingScreenShareFocus.css";

type ShareScale = "fit" | "fill" | "actual";

function ShareVideo({ share, scale }: { share: MeetingClientScreenShare; scale: ShareScale }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = share.stream;
    return () => { if (ref.current) ref.current.srcObject = null; };
  }, [share.stream]);
  return <video ref={ref} autoPlay muted playsInline className={`meeting-share-video is-${scale}`} aria-label={`${share.participantName} shared screen`} />;
}

function CompactParticipant({ participant }: { participant: MeetingClientParticipant }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = participant.cameraStream ?? null;
    return () => { if (ref.current) ref.current.srcObject = null; };
  }, [participant.cameraStream]);
  return (
    <article className={`meeting-share-person${participant.isSpeaking ? " is-speaking" : ""}`}>
      {participant.cameraEnabled && participant.cameraStream ? <video ref={ref} autoPlay muted playsInline className={participant.isLocal ? "is-mirrored" : ""} aria-label={`${participant.displayName} camera`} /> : <VerifiedAvatarFrame userId={participant.userId} label={participant.displayName} avatarUrl={participant.avatarUrl} avatarSeed={participant.identity} verification={participant.verification} size="compact" avatarSize={36} />}
      <span><strong>{participant.displayName}</strong><small>{participant.handRaised ? "Hand raised" : participant.microphoneEnabled ? participant.role : "Muted"}</small></span>
      <AppIcon name={participant.microphoneEnabled ? "microphone" : "volumeOff"} size="xs" />
    </article>
  );
}

export function MeetingScreenShareFocus({ snapshot, onReturnToGrid, onReturnToSpeaker, onOpenPeople }: { snapshot: MeetingClientSnapshot; onReturnToGrid: () => void; onReturnToSpeaker: () => void; onOpenPeople: () => void }) {
  const shares = snapshot.screenShares ?? [];
  const share = shares.find((item) => item.id === snapshot.focusedShareId) ?? shares[0];
  const [scale, setScale] = useState<ShareScale>("fit");
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  const sharer = share ? participants.find((participant) => participant.identity === share.participantIdentity) : null;
  const compactParticipants = participants.filter((participant) => participant.identity !== share?.participantIdentity);
  const visibleCameraParticipants = compactParticipants.filter((participant) => participant.cameraEnabled).slice(0, 6);
  const subscription = useMemo(() => ({ visibleParticipantIdentities: visibleCameraParticipants.map((participant) => participant.identity), activeSpeakerIdentities: compactParticipants.filter((participant) => participant.isSpeaking && participant.cameraEnabled).map((participant) => participant.identity), focusedParticipantIdentity: null, visibleTileCount: Math.min(6, compactParticipants.length) }), [visibleCameraParticipants, compactParticipants]);
  const subscriptionKey = JSON.stringify(subscription);

  useEffect(() => {
    if (!share) return;
    meetingService.setFocusedScreenShare(share.id);
    if (snapshot.focusedShareId !== share.id) meetingService.setFocus(snapshot.focusedParticipantId, share.id);
  }, [share?.id, snapshot.focusedParticipantId, snapshot.focusedShareId]);
  useEffect(() => { meetingService.setVideoSubscriptions(subscription); }, [subscriptionKey]);

  if (!share) return null;
  return (
    <section className="meeting-screen-share-focus" aria-label="Screen share focus">
      <header>
        <span><small>{share.isLocal ? "You are sharing" : `${share.participantName} is sharing`}</small><strong>{share.sourceLabel ?? "Shared screen"}</strong></span>
        <div className="meeting-share-scale" aria-label="Shared content scale">
          {(["fit", "fill", "actual"] as const).map((value) => <button type="button" key={value} className={scale === value ? "active" : ""} aria-pressed={scale === value} onClick={() => setScale(value)}>{value === "actual" ? "Actual Size" : value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        <button type="button" onClick={onOpenPeople}><AppIcon name="users" size="sm" />People</button>
      </header>
      <div className="meeting-screen-share-focus__body">
        <div className={`meeting-screen-share-focus__viewer is-${scale}`}><ShareVideo share={share} scale={scale} /></div>
        <aside className="meeting-share-participants" aria-label="Meeting participants">
          <div className="meeting-share-participants__sharer"><small>Sharing now</small><strong>{share.participantName}</strong>{sharer ? <span>{sharer.role}{sharer.communityRole?.name ? ` / ${sharer.communityRole.name}` : ""}</span> : null}</div>
          <div className="meeting-share-participants__list">{compactParticipants.map((participant) => <CompactParticipant key={participant.id} participant={participant} />)}</div>
        </aside>
      </div>
      <footer><span>{shares.length > 1 ? "Picom displays one active share at a time." : "Participant context remains visible while content is shared."}</span><button type="button" onClick={onReturnToGrid}>Return to Grid</button><button type="button" onClick={onReturnToSpeaker}>Speaker view</button></footer>
    </section>
  );
}
