import { AppIcon } from "../AppIcon";

export function AudioPlaybackButton({ isPlaying, onToggle, compact = false }: { isPlaying: boolean; onToggle: () => void; compact?: boolean }) {
  return <button type="button" className={`audio-playback-button ${compact ? "compact" : ""}`} aria-label={isPlaying ? "Pause audio" : "Play audio"} onClick={onToggle}><AppIcon name={isPlaying ? "pause" : "play"} size={compact ? "sm" : "lg"} /></button>;
}
