import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "picom-voice-participants-rail-visible-v1";

function readStoredVisibility(defaultVisible: boolean) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    return defaultVisible;
  }

  return defaultVisible;
}

export function useVoiceParticipantsRailState(defaultVisible = false) {
  const [participantsVisible, setParticipantsVisible] = useState(() => readStoredVisibility(defaultVisible));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(participantsVisible));
    } catch {
      // Local persistence is a convenience only; the desktop layout should continue without it.
    }
  }, [participantsVisible]);

  const showParticipants = useCallback(() => setParticipantsVisible(true), []);
  const hideParticipants = useCallback(() => setParticipantsVisible(false), []);
  const toggleParticipantsVisible = useCallback(() => setParticipantsVisible((visible) => !visible), []);

  return {
    participantsVisible,
    showParticipants,
    hideParticipants,
    toggleParticipantsVisible,
  };
}
