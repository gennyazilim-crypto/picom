import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { MeetingVoiceLounge } from "./MeetingVoiceLounge";
import { MeetingVideoGrid } from "./MeetingVideoGrid";
import { MeetingSpeakerFocus } from "./MeetingSpeakerFocus";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

function ParticipantTile({
  participant,
  focused,
  onFocus,
}: {
  participant: MeetingClientParticipant;
  focused: boolean;
  onFocus: () => void;
}) {
  const status = participant.isSpeaking ? "Speaking" : participant.microphoneEnabled ? "Connected" : "Muted";
  return (
    <button
      type="button"
      className={`meeting-participant-tile${participant.isSpeaking ? " is-speaking" : ""}${focused ? " is-focused" : ""}`}
      aria-label={`Focus ${participant.displayName}`}
      aria-pressed={focused}
      onClick={onFocus}
    >
      <span className="meeting-participant-tile__avatar" aria-hidden="true">{initials(participant.displayName)}</span>
      <span className="meeting-participant-tile__shade" aria-hidden="true" />
      <span className="meeting-participant-tile__name"><strong>{participant.displayName}{participant.isLocal ? " (you)" : ""}</strong><small>{status}</small></span>
      <span className="meeting-participant-tile__media" aria-label={participant.microphoneEnabled ? "Microphone on" : "Microphone muted"}><AppIcon name="microphone" size="xs" /></span>
      {participant.handRaised ? <span className="meeting-participant-tile__hand">Hand raised</span> : null}
    </button>
  );
}

export function MeetingStage({
  snapshot,
  onFocusParticipant,
  onOpenPeople,
}: {
  snapshot: MeetingClientSnapshot;
  onFocusParticipant: (id: string | null) => void;
  onOpenPeople: () => void;
}) {
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
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
            <ParticipantTile
              key={participant.id}
              participant={participant}
              focused={participant.id === snapshot.focusedParticipantId}
              onFocus={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)}
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
