import { useEffect } from "react";
import type { AudioPlayableItem } from "../../types/audio";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { audioPlayerService } from "../../services/audio/audioPlayerService";
import { audioPlaybackCoordinatorService } from "../../services/audio/audioPlaybackCoordinatorService";

export type AudioPlaybackState = Readonly<{ isPlaying: boolean; currentTime: number; duration: number; volume: number; muted: boolean; playbackRate: number; queueIndex: number; queueLength: number; loading: boolean; error: string | null; progressError: string | null }>;

export function useAudioPlayback(item: AudioPlayableItem) {
  const player = useAudioPlayer();
  useEffect(() => {
    if (player.item?.id !== item.id || player.item.type !== item.type) void audioPlaybackCoordinatorService.select(item);
  }, [item, player.item?.id, player.item?.type]);
  return {
    state: {
      isPlaying: player.status === "playing",
      currentTime: player.currentTime,
      duration: player.duration || item.durationSeconds,
      volume: player.volume,
      muted: player.muted,
      playbackRate: player.playbackRate,
      queueIndex: player.queueIndex,
      queueLength: player.queue.length,
      loading: player.status === "loading" || player.status === "reconnecting",
      error: player.error,
      progressError: player.progressError,
    },
    togglePlayback: () => audioPlayerService.togglePlayback(),
    seek: (value: number) => audioPlayerService.seek(value),
    setVolume: (value: number) => audioPlayerService.setVolume(value),
    toggleMute: () => audioPlayerService.toggleMuted(),
    setPlaybackRate: (value: number) => audioPlayerService.setPlaybackRate(value),
    previous: () => audioPlayerService.previous(),
    next: () => audioPlayerService.next(),
    stop: () => audioPlayerService.stop(),
  };
}
