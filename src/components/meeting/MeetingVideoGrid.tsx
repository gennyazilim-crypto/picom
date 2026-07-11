import { useEffect, useMemo, useRef, useState } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { buildMeetingVideoGridPlan } from "../../types/meetingVideoGrid";
import { AppIcon } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import "./MeetingVideoGrid.css";

function CameraVideo({ stream, mirrored }: { stream: MediaStream; mirrored: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
    return () => { if (ref.current) ref.current.srcObject = null; };
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className={mirrored ? "is-mirrored" : ""} aria-label={mirrored ? "Your camera preview" : "Participant camera"} />;
}

function VideoParticipantTile({ participant, focused, onFocus }: { participant: MeetingClientParticipant; focused: boolean; onFocus: () => void }) {
  const hasLiveCamera = participant.cameraEnabled && Boolean(participant.cameraStream);
  return (
    <article className={`meeting-video-tile${participant.isSpeaking ? " is-speaking" : ""}${focused ? " is-focused" : ""}`} data-camera={participant.cameraEnabled ? "published" : "off"}>
      <button type="button" className="meeting-video-tile__focus" aria-label={`${focused ? "Unpin" : "Pin"} ${participant.displayName}`} aria-pressed={focused} onClick={onFocus}>
        {hasLiveCamera ? <CameraVideo stream={participant.cameraStream!} mirrored={participant.isLocal} /> : (
          <span className="meeting-video-tile__avatar">
            <VerifiedAvatarFrame userId={participant.userId} label={participant.displayName} avatarUrl={participant.avatarUrl} avatarSeed={participant.identity} verification={participant.verification} size="medium" avatarSize={68} />
            <small>{participant.cameraEnabled ? "Connecting camera" : "Camera off"}</small>
          </span>
        )}
      </button>
      <span className="meeting-video-tile__overlay" aria-hidden="true" />
      <span className="meeting-video-tile__identity"><span><strong>{participant.displayName}{participant.isLocal ? " (you)" : ""}</strong><VerifiedBadge verification={participant.verification} size="xs" /></span><small>{participant.role}{participant.communityRole?.name ? ` / ${participant.communityRole.name}` : ""}</small></span>
      <span className="meeting-video-tile__states">
        {participant.handRaised ? <span>Hand raised</span> : null}
        <span title={`${participant.connectionQuality} connection`}>{participant.connectionQuality}</span>
        <span aria-label={participant.microphoneEnabled ? "Microphone on" : "Microphone muted"}><AppIcon name={participant.microphoneEnabled ? "microphone" : "volumeOff"} size="xs" /></span>
      </span>
    </article>
  );
}

export function MeetingVideoGrid({ snapshot, onFocusParticipant, onOpenPeople }: { snapshot: MeetingClientSnapshot; onFocusParticipant: (id: string | null) => void; onOpenPeople: () => void }) {
  const [requestedPage, setRequestedPage] = useState(0);
  const plan = useMemo(() => buildMeetingVideoGridPlan(snapshot, requestedPage), [snapshot, requestedPage]);
  const subscriptionKey = JSON.stringify(plan.subscription);
  useEffect(() => { if (requestedPage !== plan.page) setRequestedPage(plan.page); }, [plan.page, requestedPage]);
  useEffect(() => { if (snapshot.focusedParticipantId) setRequestedPage(0); }, [snapshot.focusedParticipantId]);
  useEffect(() => { meetingService.setVideoSubscriptions(plan.subscription); }, [subscriptionKey]);
  useEffect(() => () => { meetingService.setVideoSubscriptions({ visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 }); }, []);
  return (
    <section className="meeting-video-grid" aria-label="Meeting camera grid">
      <header><span><small>{snapshot.context?.communityName ?? "Picom community"}</small><strong>{snapshot.context?.roomTitle ?? "Video meeting"}</strong></span><span className="meeting-video-grid__summary"><AppIcon name="users" size="xs" />{plan.totalParticipants} participants</span><button type="button" onClick={onOpenPeople}><AppIcon name="users" size="sm" />People</button></header>
      <div className="meeting-video-grid__tiles" data-layout={plan.layout} role="list" aria-label={`Video page ${plan.page + 1} of ${plan.pageCount}`}>
        {plan.participants.map((participant) => <div role="listitem" key={participant.id}><VideoParticipantTile participant={participant} focused={participant.id === snapshot.focusedParticipantId} onFocus={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)} /></div>)}
      </div>
      {plan.pageCount > 1 ? <footer aria-live="polite"><button type="button" disabled={plan.page === 0} onClick={() => setRequestedPage((page) => Math.max(0, page - 1))}>Previous</button><span>Page {plan.page + 1} of {plan.pageCount}</span><button type="button" disabled={plan.page === plan.pageCount - 1} onClick={() => setRequestedPage((page) => Math.min(plan.pageCount - 1, page + 1))}>Next</button></footer> : null}
    </section>
  );
}
