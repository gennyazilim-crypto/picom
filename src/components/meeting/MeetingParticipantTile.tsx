import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import type { MeetingClientParticipant } from "../../types/meetingClient";
import { meetingParticipantLocalControlService } from "../../services/meeting/meetingParticipantLocalControlService";
import { AppIcon } from "../AppIcon";
import { VerifiedAvatarFrame } from "../VerifiedAvatarFrame";
import { VerifiedBadge } from "../VerifiedBadge";
import { useMeetingParticipantActionsOptional } from "./MeetingParticipantActionsProvider";
import "./MeetingParticipantTile.css";

export type MeetingParticipantTileVariant = "grid" | "focus" | "filmstrip" | "voice" | "stage" | "share";

type Props = Readonly<{
  participant: MeetingClientParticipant;
  variant: MeetingParticipantTileVariant;
  selected?: boolean;
  focused?: boolean;
  auxiliaryLabel?: string;
  onActivate?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onMore?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}>;

function ParticipantVideo({ participant }: { participant: MeetingClientParticipant }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = participant.cameraStream ?? null;
    return () => { if (ref.current) ref.current.srcObject = null; };
  }, [participant.cameraStream]);
  return <video ref={ref} autoPlay muted playsInline className={participant.isLocal ? "is-mirrored" : ""} aria-label={`${participant.displayName} camera`} />;
}

function accessibleState(participant: MeetingClientParticipant): string {
  return [
    participant.role,
    participant.isSpeaking ? "speaking" : null,
    participant.microphoneEnabled ? "microphone on" : "microphone muted",
    participant.cameraEnabled ? "camera on" : "camera off",
    participant.handRaised ? "hand raised" : null,
    participant.screenSharing ? "screen sharing" : null,
    `${participant.connectionQuality} connection`,
    participant.presence,
  ].filter(Boolean).join(", ");
}

export function MeetingParticipantTile({ participant, variant, selected = false, focused = false, auxiliaryLabel, onActivate, onContextMenu, onMore, className = "" }: Props) {
  useSyncExternalStore(meetingParticipantLocalControlService.subscribe, meetingParticipantLocalControlService.getRevision, meetingParticipantLocalControlService.getRevision);
  const participantActions = useMeetingParticipantActionsOptional();
  const localControls = meetingParticipantLocalControlService.get(participant.identity);
  const selfViewHidden = participant.isLocal && !localControls.selfViewVisible;
  const liveCamera = participant.cameraEnabled && Boolean(participant.cameraStream) && !selfViewHidden;
  const avatarSize = variant === "focus" ? 112 : variant === "voice" || variant === "stage" ? 64 : variant === "grid" ? 58 : 34;
  const media = liveCamera ? <ParticipantVideo participant={participant} /> : <span className="meeting-participant-tile-v2__avatar"><VerifiedAvatarFrame userId={participant.userId} label={participant.displayName} avatarUrl={participant.avatarUrl} avatarSeed={participant.identity} verification={participant.verification} size={avatarSize <= 36 ? "compact" : "medium"} avatarSize={avatarSize} /><small>{selfViewHidden ? "Self view hidden" : participant.cameraEnabled ? "Connecting camera" : "Camera off"}</small></span>;
  const label = `${participant.displayName}${participant.isLocal ? ", you" : ""}, ${accessibleState(participant)}`;
  const handleContextMenu = onContextMenu ?? (participantActions ? (event: MouseEvent<HTMLElement>) => participantActions.openMenu(event, participant) : undefined);
  const handleMore = onMore ?? (participantActions ? (event: MouseEvent<HTMLButtonElement>) => participantActions.openMenu(event, participant) : undefined);
  return (
    <article
      className={`meeting-participant-tile-v2${participant.isSpeaking ? " is-speaking" : ""}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""} ${className}`.trim()}
      data-variant={variant}
      data-presence={participant.presence}
      data-quality={participant.connectionQuality}
      aria-label={label}
      onContextMenu={handleContextMenu}
    >
      {onActivate ? <button type="button" className="meeting-participant-tile-v2__media" aria-label={`${focused ? "Remove focus from" : "Focus"} ${participant.displayName}`} aria-pressed={focused || selected} onClick={onActivate}>{media}</button> : <div className="meeting-participant-tile-v2__media">{media}</div>}
      <span className="meeting-participant-tile-v2__shade" aria-hidden="true" />
      <span className="meeting-participant-tile-v2__presence" aria-label={`${participant.displayName} is ${participant.presence}`} />
      <span className="meeting-participant-tile-v2__identity">
        <span className="meeting-participant-tile-v2__name"><strong>{participant.displayName}{participant.isLocal ? " (you)" : ""}</strong><VerifiedBadge verification={participant.verification} size={variant === "focus" ? "sm" : "xs"} /></span>
        <span className="meeting-participant-tile-v2__role">{participant.role}{participant.communityRole?.name ? ` / ${participant.communityRole.name}` : ""}</span>
      </span>
      <span className="meeting-participant-tile-v2__states">
        {participant.handRaised ? <span className="is-hand">Hand raised</span> : null}
        {participant.screenSharing ? <span className="is-sharing">Sharing</span> : null}
        {!participant.cameraEnabled ? <span className="is-camera-off">Camera off</span> : null}
        {auxiliaryLabel ? <span className="is-auxiliary">{auxiliaryLabel}</span> : null}
        <span className="is-quality" aria-label={`${participant.connectionQuality} connection`}>{participant.connectionQuality}</span>
        <span className="is-microphone" aria-label={participant.microphoneEnabled ? "Microphone on" : "Microphone muted"}><AppIcon name={participant.microphoneEnabled ? "microphone" : "volumeOff"} size="xs" /></span>
      </span>
      {handleMore ? <button type="button" className="meeting-participant-tile-v2__more" aria-label={`Actions for ${participant.displayName}`} aria-haspopup="menu" onClick={handleMore}><AppIcon name="more" size="sm" /></button> : null}
    </article>
  );
}
