export function formatAudioTime(value: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AudioProgressBar({ currentTime, duration, onSeek }: { currentTime: number; duration: number; onSeek: (value: number) => void }) {
  return <div className="audio-progress"><span>{formatAudioTime(currentTime)}</span><input type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(currentTime, duration)} onChange={(event) => onSeek(Number(event.target.value))} aria-label="Audio playback position" /><span>{formatAudioTime(duration)}</span></div>;
}
