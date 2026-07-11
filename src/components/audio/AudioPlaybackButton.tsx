import { AppIcon } from "../AppIcon";

export function AudioPlaybackButton({ isPlaying, onToggle, compact = false, disabled = false, loading = false }: { isPlaying: boolean; onToggle: () => void; compact?: boolean; disabled?: boolean; loading?: boolean }) {
  const label = loading ? "Audio is loading" : isPlaying ? "Pause audio" : "Play audio";
  return <button type="button" className={"audio-playback-button " + (compact ? "compact" : "")} aria-label={label} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onToggle}><AppIcon name={isPlaying ? "pause" : "play"} size={compact ? "sm" : "lg"} /></button>;
}
