import { useState, type MouseEvent } from "react";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { OverlayMenuItem } from "../../state/useOverlayState";
import { AppIcon } from "../AppIcon";
import { DesktopContextMenu } from "../DesktopContextMenu";
import { MeetingParticipantTile } from "./MeetingParticipantTile";
import "./MeetingVoiceLounge.css";

type MenuState = Readonly<{ x: number; y: number; participantId: string }>;

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
  const [menu, setMenu] = useState<MenuState | null>(null);
  const density = participants.length <= 4 ? "small" : participants.length <= 12 ? "medium" : "large";
  const selected = menu ? participants.find((participant) => participant.id === menu.participantId) : null;
  const menuItems: OverlayMenuItem[] = selected ? [
    {
      label: selected.id === snapshot.focusedParticipantId ? "Remove participant focus" : "Focus participant",
      onSelect: () => onFocusParticipant(selected.id === snapshot.focusedParticipantId ? null : selected.id),
    },
    { label: "Open people panel", onSelect: onOpenPeople },
  ] : [];

  const openMenu = (participantId: string, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ x: event.clientX || rect.right, y: event.clientY || rect.bottom, participantId });
  };

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
            onContextMenu={(event) => openMenu(participant.id, event)}
            onMore={(event) => openMenu(participant.id, event)}
          />
        ))}
      </div>

      {menu ? <DesktopContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} /> : null}
    </section>
  );
}
