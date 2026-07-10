import type { AudioPlayableItem } from "../../types/audio";
import { AppIcon } from "../AppIcon";
import { AudioNowPlayingCard } from "./AudioNowPlayingCard";
import { AudioPlaybackButton } from "./AudioPlaybackButton";
import { AudioProgressBar } from "./AudioProgressBar";
import { AudioVolumeControl } from "./AudioVolumeControl";
import { useAudioPlayback } from "./useAudioPlayback";

export function AudioMiniPlayer({ item, onClose }: { item: AudioPlayableItem; onClose: () => void }) {
  const playback = useAudioPlayback(item);
  return <section className="audio-mini-player" aria-label={`Mini player for ${item.title}`}><AudioNowPlayingCard item={item} compact /><div className="audio-mini-actions"><AudioPlaybackButton isPlaying={playback.state.isPlaying} onToggle={() => void playback.togglePlayback()} compact /><AudioVolumeControl volume={playback.state.volume} muted={playback.state.muted} onVolumeChange={playback.setVolume} onToggleMute={playback.toggleMute} compact /><button type="button" aria-label="Stop and close audio player" onClick={() => { playback.stop(); onClose(); }}><AppIcon name="close" size="sm" /></button></div><AudioProgressBar currentTime={playback.state.currentTime} duration={playback.state.duration} onSeek={playback.seek} /></section>;
}
