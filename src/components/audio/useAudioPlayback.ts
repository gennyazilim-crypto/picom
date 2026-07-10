import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioPlayableItem } from "../../types/audio";

export type AudioPlaybackState = Readonly<{ isPlaying: boolean; currentTime: number; duration: number; volume: number; muted: boolean }>;

export function useAudioPlayback(item: AudioPlayableItem) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlaybackState>({ isPlaying: false, currentTime: 0, duration: item.durationSeconds, volume: 0.72, muted: false });

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; audioRef.current = null; }
    setState((current) => ({ ...current, isPlaying: false, currentTime: 0, duration: item.durationSeconds }));
    return () => { const active = audioRef.current; if (active) { active.pause(); active.src = ""; audioRef.current = null; } };
  }, [item.id, item.durationSeconds]);

  useEffect(() => {
    if (!state.isPlaying || item.audioUrl) return;
    const timer = window.setInterval(() => setState((current) => {
      const nextTime = Math.min(current.duration, current.currentTime + 1);
      return { ...current, currentTime: nextTime, isPlaying: nextTime < current.duration };
    }), 1000);
    return () => window.clearInterval(timer);
  }, [item.audioUrl, state.isPlaying]);

  const ensureAudio = useCallback(() => {
    if (!item.audioUrl) return null;
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(item.audioUrl);
    audio.preload = "metadata";
    audio.volume = state.volume;
    audio.muted = state.muted;
    audio.ontimeupdate = () => setState((current) => ({ ...current, currentTime: audio.currentTime }));
    audio.onloadedmetadata = () => setState((current) => ({ ...current, duration: Number.isFinite(audio.duration) ? audio.duration : item.durationSeconds }));
    audio.onended = () => setState((current) => ({ ...current, isPlaying: false, currentTime: current.duration }));
    audioRef.current = audio;
    return audio;
  }, [item.audioUrl, item.durationSeconds, state.muted, state.volume]);

  const togglePlayback = useCallback(async () => {
    if (state.isPlaying) { audioRef.current?.pause(); setState((current) => ({ ...current, isPlaying: false })); return; }
    const audio = ensureAudio();
    if (audio) { try { await audio.play(); setState((current) => ({ ...current, isPlaying: true })); } catch { setState((current) => ({ ...current, isPlaying: false })); } }
    else setState((current) => ({ ...current, isPlaying: true }));
  }, [ensureAudio, state.isPlaying]);

  const seek = (value: number) => { const next = Math.max(0, Math.min(state.duration, value)); if (audioRef.current) audioRef.current.currentTime = next; setState((current) => ({ ...current, currentTime: next })); };
  const setVolume = (value: number) => { const next = Math.max(0, Math.min(1, value)); if (audioRef.current) audioRef.current.volume = next; setState((current) => ({ ...current, volume: next, muted: next === 0 ? true : current.muted })); };
  const toggleMute = () => setState((current) => { const muted = !current.muted; if (audioRef.current) audioRef.current.muted = muted; return { ...current, muted }; });
  const stop = () => { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; } setState((current) => ({ ...current, isPlaying: false, currentTime: 0 })); };

  return { state, togglePlayback, seek, setVolume, toggleMute, stop };
}
