import { useEffect, useState, useSyncExternalStore } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import { getMeetingReactionOption } from "../../services/meeting/meetingReactionCatalog";
import "./MeetingReactionOverlay.css";

export function MeetingReactionOverlay({ participantIdentity, participantName }: { participantIdentity: string; participantName: string }) {
  const snapshot = useSyncExternalStore(meetingService.store.subscribe, meetingService.store.getSnapshot, meetingService.store.getSnapshot);
  const [clock, setClock] = useState(() => Date.now());
  const active = snapshot.reactions
    .filter((reaction) => reaction.senderIdentity === participantIdentity && Date.parse(reaction.expiresAt) > clock)
    .slice(-3);

  useEffect(() => {
    const expiry = snapshot.reactions
      .filter((reaction) => reaction.senderIdentity === participantIdentity)
      .reduce((nearest, reaction) => Math.min(nearest, Date.parse(reaction.expiresAt)), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(expiry) || expiry <= clock) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(16, expiry - Date.now() + 16));
    return () => window.clearTimeout(timer);
  }, [clock, participantIdentity, snapshot.reactions]);

  if (!active.length) return null;
  return <span className="meeting-reaction-overlay" role="group" aria-label={`Recent reactions from ${participantName}`}>
    {active.map((reaction) => {
      const option = getMeetingReactionOption(reaction.kind);
      return <span className="meeting-reaction-overlay__item" key={reaction.id} title={option.label}><span aria-hidden="true">{option.emoji}</span><span className="sr-only">{option.label}</span></span>;
    })}
  </span>;
}
