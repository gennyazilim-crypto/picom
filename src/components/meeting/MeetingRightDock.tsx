import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingSidePanel } from "../../types/meeting";
import { AppIcon } from "../AppIcon";
import { VerifiedBadge } from "../VerifiedBadge";

const tabs: ReadonlyArray<{ id: Extract<MeetingSidePanel, "people" | "info">; label: string }> = [
  { id: "people", label: "People" },
  { id: "info", label: "Info" },
];

function DockParticipant({ participant, selected, onSelect }: { participant: MeetingClientParticipant; selected: boolean; onSelect: () => void }) {
  return (
    <div className={`meeting-dock-person-v2${selected ? " is-selected" : ""}`}>
      <button type="button" className="meeting-dock-person-v2__avatar" aria-label={`Select ${participant.displayName}`} onClick={onSelect}>
        {participant.displayName.slice(0, 1).toUpperCase()}
      </button>
      <span className="meeting-dock-person-v2__identity">
        <button type="button" className="meeting-dock-person-v2__name" onClick={onSelect}>{participant.displayName}</button>
        <small>{participant.role}{participant.communityRole?.name ? ` / ${participant.communityRole.name}` : ""}</small>
      </span>
      <VerifiedBadge verification={participant.verification} size="xs" />
      <span className="meeting-dock-person-v2__signal" aria-label={participant.isSpeaking ? "Speaking" : participant.microphoneEnabled ? "Microphone on" : "Microphone muted"}>
        <AppIcon name={participant.isSpeaking ? "voice" : participant.microphoneEnabled ? "microphone" : "volumeOff"} size="xs" />
      </span>
    </div>
  );
}

export function MeetingRightDock({
  snapshot,
  onSelect,
  onFocusParticipant,
  onClose,
}: {
  snapshot: MeetingClientSnapshot;
  onSelect: (panel: MeetingSidePanel) => void;
  onFocusParticipant: (id: string | null) => void;
  onClose: () => void;
}) {
  const active = snapshot.rightDock === "info" ? "info" : "people";
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean);
  const localParticipant = participants.find((participant) => participant.isLocal);
  return (
    <aside className="meeting-right-dock" aria-label="Meeting side panel">
      <header>
        <div><small>Meeting dock</small><strong>{active === "people" ? `${participants.length} people` : "Room information"}</strong></div>
        <button type="button" aria-label="Close meeting side panel" onClick={onClose}><AppIcon name="close" size="sm" /></button>
      </header>
      <nav aria-label="Meeting panel sections">
        {tabs.map((tab) => <button type="button" key={tab.id} className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => onSelect(tab.id)}>{tab.label}</button>)}
      </nav>
      <div className="meeting-right-dock__content">
        {active === "people" ? (
          <div className="meeting-dock-people">
            {participants.length ? participants.map((participant) => (
              <DockParticipant
                key={participant.id}
                participant={participant}
                selected={participant.id === snapshot.focusedParticipantId}
                onSelect={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)}
              />
            )) : (
              <div className="meeting-dock-empty"><AppIcon name="users" size="lg" /><strong>No participants yet</strong><span>The list updates when people join.</span></div>
            )}
          </div>
        ) : (
          <dl className="meeting-room-info">
            <div><dt>Room</dt><dd>{snapshot.context?.roomTitle ?? "Meeting"}</dd></div>
            <div><dt>Community</dt><dd>{snapshot.context?.communityName ?? "Picom"}</dd></div>
            <div><dt>Connection</dt><dd>{snapshot.phase}</dd></div>
            <div><dt>Layout</dt><dd>{snapshot.layout}</dd></div>
            <div><dt>Your role</dt><dd>{snapshot.role ?? "Not assigned"}</dd></div>
            {localParticipant ? <div><dt>Your Noise Shield</dt><dd>{snapshot.noiseShield.status}</dd></div> : null}
          </dl>
        )}
      </div>
    </aside>
  );
}
