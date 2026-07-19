import { useEffect, type KeyboardEvent } from "react";
import type { AudioPlayableItem } from "../../types/audio";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { audioPlayerService, PODCAST_PLAYBACK_RATES } from "../../services/audio/audioPlayerService";
import { audioPlaybackCoordinatorService } from "../../services/audio/audioPlaybackCoordinatorService";
import { AppIcon } from "../AppIcon";
import { AudioNowPlayingCard } from "./AudioNowPlayingCard";
import { AudioPlaybackButton } from "./AudioPlaybackButton";
import { AudioProgressBar, formatAudioTime } from "./AudioProgressBar";
import { AudioVolumeControl } from "./AudioVolumeControl";
import "./AudioMiniPlayer.css";

export function AudioMiniPlayer({ item, queue, onClose }: { item?: AudioPlayableItem; queue?: readonly AudioPlayableItem[]; onClose?: () => void }) {
  const player = useAudioPlayer();
  useEffect(() => {
    if (item) void audioPlaybackCoordinatorService.select(item, queue);
  }, [item?.id, item?.type]);
  const active = player.item;
  if (!active) return null;
  const isPodcast = active.type === "podcast_episode";
  const loading = player.status === "loading" || player.status === "reconnecting";
  const status =
    player.error ??
    (player.status === "reconnecting"
      ? "Reconnecting live stream..."
      : player.status === "loading"
        ? "Connecting..."
        : player.status === "ended"
          ? active.isLive
            ? "Broadcast ended"
            : "Episode completed"
          : active.isLive
            ? "Live Radio"
            : player.resumedFrom
              ? `Resumed at ${formatAudioTime(player.resumedFrom)}`
              : "Ready");
  const close = async () => {
    const result = await audioPlaybackCoordinatorService.stopCurrent();
    if (result.ok) onClose?.();
  };
  const onKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      void audioPlayerService.togglePlayback();
    } else if (isPodcast && event.key === "ArrowLeft") {
      event.preventDefault();
      audioPlayerService.seek(player.currentTime - 15);
    } else if (isPodcast && event.key === "ArrowRight") {
      event.preventDefault();
      audioPlayerService.seek(player.currentTime + 15);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      audioPlayerService.toggleMuted();
    }
  };
  const canPrevious = isPodcast && (player.queueIndex > 0 || player.currentTime > 5);
  const canNext = isPodcast && player.queueIndex >= 0 && player.queueIndex < player.queue.length - 1;

  return (
    <section
      className={"audio-mini-player status-" + player.status}
      aria-label={"Mini player for " + active.title}
      aria-keyshortcuts="Space ArrowLeft ArrowRight M"
      tabIndex={0}
      onKeyDown={onKeyboard}
    >
      <header className="audio-mini-player-head">
        <AudioNowPlayingCard item={active} compact />
        <button type="button" className="audio-mini-close" aria-label="Stop, leave, and close audio player" onClick={() => void close()}>
          <AppIcon name="close" size="sm" />
        </button>
      </header>

      <div className="audio-mini-toolbar" aria-label="Playback controls">
        {isPodcast ? (
          <div className="audio-queue-transport" aria-label="Podcast queue controls">
            <button type="button" className="audio-queue-button previous" aria-label="Previous episode or restart current episode" disabled={!canPrevious} onClick={() => void audioPlayerService.previous()}>
              <AppIcon name="chevronRight" size="sm" />
            </button>
            <AudioPlaybackButton isPlaying={player.status === "playing"} loading={loading} disabled={player.status === "error"} onToggle={() => void audioPlayerService.togglePlayback()} compact />
            <button type="button" className="audio-queue-button" aria-label="Next episode" disabled={!canNext} onClick={() => void audioPlayerService.next()}>
              <AppIcon name="chevronRight" size="sm" />
            </button>
          </div>
        ) : (
          <AudioPlaybackButton
            isPlaying={player.status === "playing"}
            loading={loading}
            disabled={player.status === "ended" || player.status === "error"}
            onToggle={() => void audioPlayerService.togglePlayback()}
            compact
          />
        )}
        <AudioVolumeControl volume={player.volume} muted={player.muted} onVolumeChange={audioPlayerService.setVolume} onToggleMute={audioPlayerService.toggleMuted} compact />
        {isPodcast ? (
          <label className="audio-rate-control">
            <span>Speed</span>
            <select aria-label="Podcast playback speed" value={player.playbackRate} onChange={(event) => audioPlayerService.setPlaybackRate(Number(event.target.value))}>
              {PODCAST_PLAYBACK_RATES.map((rate) => (
                <option value={rate} key={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isPodcast && player.queue.length > 1 ? (
          <span className="audio-queue-position" aria-label={`Episode ${player.queueIndex + 1} of ${player.queue.length}`}>
            {player.queueIndex + 1}/{player.queue.length}
          </span>
        ) : null}
      </div>

      {active.isLive ? (
        <div className="audio-live-status" role={player.error ? "alert" : "status"}>
          <i aria-hidden="true" />
          {status}
        </div>
      ) : (
        <>
          <AudioProgressBar currentTime={player.currentTime} duration={player.duration || active.durationSeconds} onSeek={audioPlayerService.seek} />
          <div className="audio-playback-status" role={player.error ? "alert" : "status"}>
            {player.progressError ?? status}
          </div>
        </>
      )}
    </section>
  );
}
