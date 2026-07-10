import type { AudioPlayableItem } from "../../types/audio";
import { AudioNowPlayingCard } from "./AudioNowPlayingCard";
import { AudioPlaybackButton } from "./AudioPlaybackButton";
import { AudioProgressBar } from "./AudioProgressBar";
import { AudioVolumeControl } from "./AudioVolumeControl";
import { useAudioPlayback } from "./useAudioPlayback";

export function AudioPlayer({ item, className = "" }: { item: AudioPlayableItem; className?: string }) {
  const playback = useAudioPlayback(item);
  return <section className={`audio-player ${className}`} aria-label={`Audio player for ${item.title}`}><AudioNowPlayingCard item={item} /><div className="audio-player-controls"><AudioPlaybackButton isPlaying={playback.state.isPlaying} onToggle={() => void playback.togglePlayback()} /><AudioProgressBar currentTime={playback.state.currentTime} duration={playback.state.duration} onSeek={playback.seek} /><AudioVolumeControl volume={playback.state.volume} muted={playback.state.muted} onVolumeChange={playback.setVolume} onToggleMute={playback.toggleMute} /></div></section>;
}
