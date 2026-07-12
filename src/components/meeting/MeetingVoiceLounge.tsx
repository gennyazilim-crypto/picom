import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon } from "../AppIcon";
import { MeetingParticipantTile } from "./MeetingParticipantTile";
import "./MeetingVoiceLounge.css";

export function MeetingVoiceLounge({
  snapshot,
  participants,
  onFocusParticipant,
  onOpenPeople,
}: {
  snapshot: MeetingClientSnapshot;
  participants: readonly MeetingClientParticipant[];
  onFocusParticipant: (id: string | null) => void;
  onOpenPeople: () => void;
}) {
  const density = participants.length <= 4 ? "small" : participants.length <= 12 ? "medium" : "large";

  return (
    <section className="meeting-voice-lounge" aria-label="Voice lounge">
      <header className="meeting-voice-lounge__header">
        <span className="meeting-voice-lounge__mark"><AppIcon name="voice" size="lg" /></span>
        <span className="meeting-voice-lounge__title">
          <small>{snapshot.context?.communityName ?? "Picom community"}</small>
          <strong>{snapshot.context?.roomTitle ?? "Voice lounge"}</strong>
        </span>
        <span className="meeting-voice-lounge__count"><AppIcon name="users" size="xs" />{participants.length} connected</span>
        <button type="button" onClick={onOpenPeople}><AppIcon name="users" size="sm" />People</button>
      </header>

      <div className="meeting-voice-lounge__grid" data-density={density} role="list" aria-label={`${participants.length} voice participants`}>
        {participants.map((participant) => (
          <MeetingParticipantTile
            key={participant.id}
            participant={participant}
            variant="voice"
            selected={participant.id === snapshot.focusedParticipantId}
            auxiliaryLabel={participant.isLocal && snapshot.noiseShield.status !== "off" ? `Noise Shield ${snapshot.noiseShield.status}` : undefined}
            onActivate={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)}
          />
        ))}
      </div>
    </section>
  );
}
