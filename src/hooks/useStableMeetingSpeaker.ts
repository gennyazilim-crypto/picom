import { useEffect, useRef, useState } from "react";
import type { MeetingClientParticipant } from "../types/meetingClient";

export const MEETING_SPEAKER_DEBOUNCE_MS = 650;
export const MEETING_SPEAKER_SILENCE_HOLD_MS = 1_600;

export function useStableMeetingSpeaker(participants: readonly MeetingClientParticipant[], manualPinId: string | null): string | null {
  const [stableSpeakerId, setStableSpeakerId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastSpeakingAtRef = useRef(0);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const participantKey = participants.map((participant) => participant.id).join("|");
  const speakingKey = participants.filter((participant) => participant.isSpeaking).map((participant) => participant.id).join("|");

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    if (manualPinId) return;

    const currentParticipants = participantsRef.current;
    const ids = new Set(currentParticipants.map((participant) => participant.id));
    const speaking = currentParticipants.filter((participant) => participant.isSpeaking);
    if (stableSpeakerId && speaking.some((participant) => participant.id === stableSpeakerId)) {
      lastSpeakingAtRef.current = Date.now();
      return;
    }

    const candidate = speaking[0];
    if (candidate) {
      timerRef.current = window.setTimeout(() => {
        lastSpeakingAtRef.current = Date.now();
        setStableSpeakerId(candidate.id);
      }, MEETING_SPEAKER_DEBOUNCE_MS);
      return;
    }

    if (stableSpeakerId && ids.has(stableSpeakerId)) {
      const elapsed = Date.now() - lastSpeakingAtRef.current;
      timerRef.current = window.setTimeout(() => {
        const fallback = currentParticipants.find((participant) => participant.cameraEnabled) ?? currentParticipants.find((participant) => participant.isLocal) ?? currentParticipants[0];
        setStableSpeakerId(fallback?.id ?? null);
      }, Math.max(0, MEETING_SPEAKER_SILENCE_HOLD_MS - elapsed));
      return;
    }

    const fallback = currentParticipants.find((participant) => participant.cameraEnabled) ?? currentParticipants.find((participant) => participant.isLocal) ?? currentParticipants[0];
    setStableSpeakerId(fallback?.id ?? null);
    return () => undefined;
  }, [manualPinId, participantKey, speakingKey, stableSpeakerId]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return stableSpeakerId;
}
