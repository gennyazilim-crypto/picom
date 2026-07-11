import { AppIcon } from "../AppIcon";

export function AudioVolumeControl({ volume, muted, onVolumeChange, onToggleMute, compact = false }: { volume: number; muted: boolean; onVolumeChange: (volume: number) => void; onToggleMute: () => void; compact?: boolean }) {
  return <div className={"audio-volume " + (compact ? "compact" : "")}><button type="button" aria-label={muted ? "Unmute audio" : "Mute audio"} onClick={onToggleMute}><AppIcon name={muted ? "volumeOff" : "volume"} size="sm" /></button><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} aria-label="Audio volume" aria-valuetext={Math.round(volume * 100) + " percent"} /></div>;
}
