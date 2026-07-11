import { useState, type MouseEvent } from "react";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { OverlayMenuItem } from "../../state/useOverlayState";
import { AppIcon } from "../AppIcon";
import { DesktopContextMenu } from "../DesktopContextMenu";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import "./MeetingVoiceLounge.css";

type MenuState = Readonly<{ x: number; y: number; participantId: string }>;

const qualityLabel = (quality: MeetingClientParticipant["connectionQuality"]) =>
  quality === "unknown" ? "Connection pending" : `${quality.slice(0, 1).toUpperCase()}${quality.slice(1)} connection`;

function SpeakingWaveform() {
  return <span className="meeting-lounge-waveform" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function LoungeParticipantCard({
  participant,
  focused,
  noiseShieldStatus,
  onFocus,
  onMenu,
}: {
  participant: MeetingClientParticipant;
  focused: boolean;
  noiseShieldStatus: MeetingClientSnapshot["noiseShield"]["status"];
  onFocus: () => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  const microphoneLabel = participant.microphoneEnabled ? "Microphone on" : "Microphone muted";
  return (
    <article
      className={`meeting-lounge-person${participant.isSpeaking ? " is-speaking" : ""}${focused ? " is-selected" : ""}`}
      data-quality={participant.connectionQuality}
      role="listitem"
      onContextMenu={onMenu}
    >
      <button type="button" className="meeting-lounge-person__avatar" aria-label={`Select ${participant.displayName}`} aria-pressed={focused} onClick={onFocus}>
        <VerifiedAvatarFrame
          userId={participant.userId}
          label={participant.displayName}
          avatarUrl={participant.avatarUrl}
          avatarSeed={participant.identity}
          verification={participant.verification}
          size="medium"
          avatarSize={64}
        />
        {participant.isSpeaking ? <SpeakingWaveform /> : null}
      </button>

      <div className="meeting-lounge-person__identity">
        <span className="meeting-lounge-person__name-row">
          <button type="button" onClick={onFocus}>{participant.displayName}{participant.isLocal ? " (you)" : ""}</button>
          <VerifiedBadge verification={participant.verification} size="xs" />
        </span>
        <span className="meeting-lounge-person__roles">
          <strong>{participant.role}</strong>
          {participant.communityRole?.name ? <small>{participant.communityRole.name}</small> : null}
        </span>
        <span className="meeting-lounge-person__signals">
          <span aria-label={microphoneLabel}><AppIcon name={participant.microphoneEnabled ? "microphone" : "volumeOff"} size="xs" />{participant.isSpeaking ? "Speaking" : microphoneLabel}</span>
          {participant.handRaised ? <span className="is-hand">Hand raised</span> : null}
          <span className="is-quality" title={qualityLabel(participant.connectionQuality)}>{participant.connectionQuality}</span>
          {participant.isLocal && noiseShieldStatus !== "off" ? <span className="is-shield">Noise Shield {noiseShieldStatus}</span> : null}
        </span>
      </div>

      <button type="button" className="meeting-lounge-person__more" aria-label={`Actions for ${participant.displayName}`} onClick={onMenu}>
        <AppIcon name="more" size="sm" />
      </button>
    </article>
  );
}

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
          <LoungeParticipantCard
            key={participant.id}
            participant={participant}
            focused={participant.id === snapshot.focusedParticipantId}
            noiseShieldStatus={snapshot.noiseShield.status}
            onFocus={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)}
            onMenu={(event) => openMenu(participant.id, event)}
          />
        ))}
      </div>

      {menu ? <DesktopContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} /> : null}
    </section>
  );
}
