import { useEffect, useMemo, useState } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { buildMeetingVideoGridPlan } from "../../types/meetingVideoGrid";
import { AppIcon } from "../AppIcon";
import { MeetingParticipantTile } from "./MeetingParticipantTile";
import "./MeetingVideoGrid.css";

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
        {plan.participants.map((participant) => <div role="listitem" key={participant.id}><MeetingParticipantTile participant={participant} variant="grid" focused={participant.id === snapshot.focusedParticipantId} onActivate={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)} /></div>)}
      </div>
      {plan.pageCount > 1 ? <footer aria-live="polite"><button type="button" disabled={plan.page === 0} onClick={() => setRequestedPage((page) => Math.max(0, page - 1))}>Previous</button><span>Page {plan.page + 1} of {plan.pageCount}</span><button type="button" disabled={plan.page === plan.pageCount - 1} onClick={() => setRequestedPage((page) => Math.min(plan.pageCount - 1, page + 1))}>Next</button></footer> : null}
    </section>
  );
}
