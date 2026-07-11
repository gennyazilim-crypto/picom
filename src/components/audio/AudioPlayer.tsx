import type { AudioPlayableItem } from "../../types/audio";
import { PODCAST_PLAYBACK_RATES } from "../../services/audio/audioPlayerService";
import { AppIcon } from "../AppIcon";
import { AudioNowPlayingCard } from "./AudioNowPlayingCard";
import { AudioPlaybackButton } from "./AudioPlaybackButton";
import { AudioProgressBar } from "./AudioProgressBar";
import { AudioVolumeControl } from "./AudioVolumeControl";
import { useAudioPlayback } from "./useAudioPlayback";

export function AudioPlayer({ item, className = "" }: { item: AudioPlayableItem; className?: string }) {
  const playback = useAudioPlayback(item);
  const podcast = item.type === "podcast_episode";
  const canPrevious = podcast && (playback.state.queueIndex > 0 || playback.state.currentTime > 5);
  const canNext = podcast && playback.state.queueIndex >= 0 && playback.state.queueIndex < playback.state.queueLength - 1;
  return <section className={"audio-player " + className} aria-label={"Audio player for " + item.title}><AudioNowPlayingCard item={item} /><div className="audio-player-controls">
    <div className="audio-queue-transport"><button type="button" className="audio-queue-button previous" aria-label="Previous episode or restart current episode" disabled={!canPrevious} onClick={() => void playback.previous()}><AppIcon name="chevronRight" size="sm" /></button><AudioPlaybackButton isPlaying={playback.state.isPlaying} loading={playback.state.loading} onToggle={() => void playback.togglePlayback()} /><button type="button" className="audio-queue-button" aria-label="Next episode" disabled={!canNext} onClick={() => void playback.next()}><AppIcon name="chevronRight" size="sm" /></button></div>
    {item.isLive ? <div className="audio-live-status" role={playback.state.error ? "alert" : "status"}><i />{playback.state.error ?? "Live Radio"}</div> : <AudioProgressBar currentTime={playback.state.currentTime} duration={playback.state.duration} onSeek={playback.seek} />}
    {podcast ? <label className="audio-rate-control"><span>Speed</span><select aria-label="Podcast playback speed" value={playback.state.playbackRate} onChange={(event) => playback.setPlaybackRate(Number(event.target.value))}>{PODCAST_PLAYBACK_RATES.map((rate) => <option value={rate} key={rate}>{rate}x</option>)}</select></label> : null}
    <AudioVolumeControl volume={playback.state.volume} muted={playback.state.muted} onVolumeChange={playback.setVolume} onToggleMute={playback.toggleMute} />
  </div>{playback.state.progressError ? <p className="audio-playback-status" role="status">{playback.state.progressError}</p> : null}</section>;
}
