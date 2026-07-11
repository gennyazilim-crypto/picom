import { useSyncExternalStore } from "react";
import { audioPlayerService } from "../services/audio/audioPlayerService";

export function useAudioPlayer() {
  return useSyncExternalStore(audioPlayerService.subscribe, audioPlayerService.getSnapshot, audioPlayerService.getSnapshot);
}
