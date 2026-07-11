import { useEffect, useMemo, useState } from "react";
import { useStableMeetingSpeaker } from "../../hooks/useStableMeetingSpeaker";
import { meetingService } from "../../services/meeting/meetingService";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { MeetingParticipantTile } from "./MeetingParticipantTile";
import "./MeetingSpeakerFocus.css";

const FILMSTRIP_PAGE_SIZE = 7;

export function MeetingSpeakerFocus({ snapshot, onOpenPeople }: { snapshot: MeetingClientSnapshot; onOpenPeople: () => void }) {
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  const manualPin = snapshot.focusedParticipantId && participants.some((participant) => participant.id === snapshot.focusedParticipantId) ? snapshot.focusedParticipantId : null;
  const automaticSpeaker = useStableMeetingSpeaker(participants, manualPin);
  const focusedId = manualPin ?? automaticSpeaker ?? participants[0]?.id ?? null;
  const focused = participants.find((participant) => participant.id === focusedId) ?? participants[0];
  const [filmstripPage, setFilmstripPage] = useState(0);
  const filmstripParticipants = participants.filter((participant) => participant.id !== focused?.id);
  const pageCount = Math.max(1, Math.ceil(filmstripParticipants.length / FILMSTRIP_PAGE_SIZE));
  const page = Math.min(filmstripPage, pageCount - 1);
  const visibleFilmstrip = filmstripParticipants.slice(page * FILMSTRIP_PAGE_SIZE, (page + 1) * FILMSTRIP_PAGE_SIZE);
  const subscription = useMemo(() => {
    const visible = [focused, ...visibleFilmstrip].filter(Boolean) as MeetingClientParticipant[];
    return {
      visibleParticipantIdentities: visible.filter((participant) => participant.cameraEnabled).map((participant) => participant.identity),
      activeSpeakerIdentities: participants.filter((participant) => participant.isSpeaking && participant.cameraEnabled).map((participant) => participant.identity),
      focusedParticipantIdentity: focused?.cameraEnabled ? focused.identity : null,
      visibleTileCount: visible.length,
    };
  }, [focused, visibleFilmstrip, participants]);
  const subscriptionKey = JSON.stringify(subscription);

  useEffect(() => { if (snapshot.focusedParticipantId && !manualPin) meetingService.setFocus(null); }, [manualPin, snapshot.focusedParticipantId]);
  useEffect(() => { if (filmstripPage !== page) setFilmstripPage(page); }, [filmstripPage, page]);
  useEffect(() => { meetingService.setVideoSubscriptions(subscription); }, [subscriptionKey]);
  useEffect(() => () => { meetingService.setVideoSubscriptions({ visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 }); }, []);

  if (!focused) return null;
  const pinned = manualPin === focused.id;
  const overflowCount = Math.max(0, filmstripParticipants.length - (page + 1) * FILMSTRIP_PAGE_SIZE);
  return (
    <section className="meeting-speaker-focus" aria-label="Speaker focus view">
      <header>
        <span><small>{pinned ? "Manually pinned" : focused.isSpeaking ? "Active speaker" : "Speaker focus"}</small><strong>{snapshot.context?.roomTitle ?? "Meeting"}</strong></span>
        <span className="meeting-speaker-focus__count"><AppIcon name="users" size="xs" />{participants.length} participants</span>
        <button type="button" onClick={onOpenPeople}><AppIcon name="users" size="sm" />People</button>
      </header>
      <div className="meeting-speaker-focus__stage">
        <MeetingParticipantTile participant={focused} variant="focus" focused={pinned} onActivate={() => meetingService.setFocus(pinned ? null : focused.id)} />
        <button type="button" className={`meeting-speaker-focus__pin${pinned ? " is-pinned" : ""}`} aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${focused.displayName}`} onClick={() => meetingService.setFocus(pinned ? null : focused.id)}><AppIcon name="pin" size="sm" />{pinned ? "Unpin" : "Pin"}</button>
      </div>
      <div className="meeting-filmstrip" aria-label="Participant filmstrip">
        <button type="button" className="meeting-filmstrip__page" disabled={page === 0} aria-label="Previous participants" onClick={() => setFilmstripPage((current) => Math.max(0, current - 1))}>Previous</button>
        <div className="meeting-filmstrip__items" role="list">
          {visibleFilmstrip.map((participant) => <div role="listitem" key={participant.id}><MeetingParticipantTile participant={participant} variant="filmstrip" focused={manualPin === participant.id} onActivate={() => meetingService.setFocus(manualPin === participant.id ? null : participant.id)} /></div>)}
        </div>
        <button type="button" className="meeting-filmstrip__page" disabled={page === pageCount - 1} aria-label="Next participants" onClick={() => setFilmstripPage((current) => Math.min(pageCount - 1, current + 1))}>Next{overflowCount > 0 ? ` +${overflowCount}` : ""}</button>
      </div>
    </section>
  );
}
