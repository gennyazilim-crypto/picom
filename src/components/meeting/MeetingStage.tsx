import { lazy, Suspense } from "react";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { MeetingVoiceLounge } from "./MeetingVoiceLounge";
import { MeetingVideoGrid } from "./MeetingVideoGrid";
import { MeetingSpeakerFocus } from "./MeetingSpeakerFocus";
import { MeetingStageAudience } from "./MeetingStageAudience";
import { MeetingParticipantTile } from "./MeetingParticipantTile";

const MeetingScreenShareFocus = lazy(() => import("./MeetingScreenShareFocus").then((module) => ({ default: module.MeetingScreenShareFocus })));

export function MeetingStage({
  snapshot,
  onFocusParticipant,
  onOpenPeople,
  onReturnToGrid,
  onReturnToSpeaker,
}: {
  snapshot: MeetingClientSnapshot;
  onFocusParticipant: (id: string | null) => void;
  onOpenPeople: () => void;
  onReturnToGrid: () => void;
  onReturnToSpeaker: () => void;
}) {
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  if (snapshot.layout === "stage") {
    return <MeetingStageAudience snapshot={snapshot} onFocusParticipant={onFocusParticipant} onOpenPeople={onOpenPeople} />;
  }
  if (snapshot.layout === "screen_share" && (snapshot.screenShares?.length ?? 0) > 0) {
    return <Suspense fallback={<section className="meeting-stage" aria-label="Loading shared content"><div className="meeting-stage__empty"><span><AppIcon name="image" size="xl" /></span><strong>Preparing shared content</strong><p>The participant strip remains available when the secure media view is ready.</p></div></section>}><MeetingScreenShareFocus snapshot={snapshot} onReturnToGrid={onReturnToGrid} onReturnToSpeaker={onReturnToSpeaker} onOpenPeople={onOpenPeople} /></Suspense>;
  }
  if (snapshot.layout === "speaker" && participants.length > 0 && !participants.some((participant) => participant.screenSharing)) {
    return <MeetingSpeakerFocus snapshot={snapshot} onOpenPeople={onOpenPeople} />;
  }
  const audioOnly = participants.length > 0 && participants.every((participant) => !participant.cameraEnabled && !participant.screenSharing);
  if (audioOnly) {
    return <MeetingVoiceLounge snapshot={snapshot} participants={participants} onFocusParticipant={onFocusParticipant} onOpenPeople={onOpenPeople} />;
  }
  if (participants.some((participant) => participant.cameraEnabled) && !participants.some((participant) => participant.screenSharing)) {
    return <MeetingVideoGrid snapshot={snapshot} onFocusParticipant={onFocusParticipant} onOpenPeople={onOpenPeople} />;
  }

  const focused = snapshot.focusedParticipantId ? participants.find((item) => item.id === snapshot.focusedParticipantId) : undefined;
  return (
    <section className="meeting-stage" aria-label="Meeting media stage" tabIndex={0} data-layout={snapshot.layout}>
      {participants.length ? (
        <div className={`meeting-stage__grid${focused ? " has-focus" : ""}`}>
          {participants.map((participant) => (
            <MeetingParticipantTile
              key={participant.id}
              participant={participant}
              variant="grid"
              focused={participant.id === snapshot.focusedParticipantId}
              onActivate={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)}
            />
          ))}
        </div>
      ) : (
        <div className="meeting-stage__empty">
          <span><AppIcon name="users" size="xl" /></span>
          <strong>The stage is ready</strong>
          <p>Participant media will appear here after the connection is established.</p>
        </div>
      )}
    </section>
  );
}
