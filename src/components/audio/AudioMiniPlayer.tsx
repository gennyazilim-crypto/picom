import { useEffect } from "react";
import type { AudioPlayableItem } from "../../types/audio";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { audioPlayerService } from "../../services/audio/audioPlayerService";
import { audioPlaybackCoordinatorService } from "../../services/audio/audioPlaybackCoordinatorService";
import { AppIcon } from "../AppIcon";
import { AudioNowPlayingCard } from "./AudioNowPlayingCard";
import { AudioPlaybackButton } from "./AudioPlaybackButton";
import { AudioProgressBar } from "./AudioProgressBar";
import { AudioVolumeControl } from "./AudioVolumeControl";

export function AudioMiniPlayer({ item, onClose }: { item?: AudioPlayableItem; onClose?: () => void }) {
  const player = useAudioPlayer();
  useEffect(() => {
    if (item) void audioPlaybackCoordinatorService.select(item);
  }, [item?.id, item?.type]);
  if (item) return null;
  const active = player.item ?? item;
  if (!active) return null;
  const loading = player.status === "loading" || player.status === "reconnecting";
  const status = player.error ?? (player.status === "reconnecting" ? "Reconnecting live stream..." : player.status === "loading" ? "Connecting..." : player.status === "ended" ? "Broadcast ended" : active.isLive ? "Live Radio" : "Ready");
  const close = async () => {
    const result = await audioPlaybackCoordinatorService.stopCurrent();
    if (result.ok) onClose?.();
  };
  return <section className={"audio-mini-player status-" + player.status} aria-label={"Mini player for " + active.title}>
    <AudioNowPlayingCard item={active} compact />
    <div className="audio-mini-actions"><AudioPlaybackButton isPlaying={player.status === "playing"} loading={loading} disabled={player.status === "ended" || player.status === "error"} onToggle={() => void audioPlayerService.togglePlayback()} compact /><AudioVolumeControl volume={player.volume} muted={player.muted} onVolumeChange={audioPlayerService.setVolume} onToggleMute={audioPlayerService.toggleMuted} compact /><button type="button" aria-label="Stop, leave, and close audio player" onClick={() => void close()}><AppIcon name="close" size="sm" /></button></div>
    {active.isLive ? <div className="audio-live-status" role={player.error ? "alert" : "status"}><i />{status}</div> : <AudioProgressBar currentTime={player.currentTime} duration={player.duration || active.durationSeconds} onSeek={audioPlayerService.seek} />}
  </section>;
}
