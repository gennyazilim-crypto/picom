import { Track, type Room } from "livekit-client";

export function applySingleScreenShareSubscription(activeRoom: Room, requestedId: string | null): string | null {
  const publications: Array<{ id: string; setSubscribed: (subscribed: boolean) => void }> = [];
  activeRoom.remoteParticipants.forEach((participant) => participant.videoTrackPublications.forEach((publication) => {
    if (publication.source === Track.Source.ScreenShare) publications.push({ id: `remote:${participant.identity}:${publication.trackSid}`, setSubscribed: (subscribed) => publication.setSubscribed(subscribed) });
  }));
  const requestedIsLocal = Boolean(requestedId?.startsWith("local:"));
  const selectedId = requestedIsLocal ? null : requestedId && publications.some((item) => item.id === requestedId) ? requestedId : publications[0]?.id ?? null;
  publications.forEach((publication) => publication.setSubscribed(!requestedIsLocal && publication.id === selectedId));
  return requestedIsLocal ? requestedId : selectedId;
}
