// Synthesized incoming-call ringtone via the WebAudio API. Using an oscillator
// pattern instead of a bundled audio file keeps the ringtone CSP-safe and avoids
// shipping a binary asset. If the audio context cannot start (e.g. autoplay policy
// before any user gesture) the call still surfaces via the visual overlay and the
// native OS notification, so a blocked ringtone never hides an incoming call.

let audioContext: AudioContext | null = null;
let schedulerTimer: number | null = null;
let active = false;

const RING_CYCLE_MS = 2600;
const TONE_GAIN = 0.16;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playRingBurst(ctx: AudioContext, startAt: number): void {
  // A gentle two-note "ring-ring" (C5 then E5), each note ~0.35s with a short gap.
  const notes: ReadonlyArray<{ offset: number; frequency: number }> = [
    { offset: 0, frequency: 523.25 },
    { offset: 0.45, frequency: 659.25 },
  ];
  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = note.frequency;
    const at = startAt + note.offset;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(TONE_GAIN, at + 0.03);
    gain.gain.setValueAtTime(TONE_GAIN, at + 0.3);
    gain.gain.linearRampToValueAtTime(0, at + 0.36);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.38);
  }
}

export const ringtoneService = {
  start(): void {
    if (active) return;
    const ctx = getContext();
    if (!ctx) return;
    active = true;
    void ctx.resume().catch(() => undefined);

    const tick = () => {
      if (!active) return;
      const context = getContext();
      if (context) playRingBurst(context, context.currentTime + 0.05);
    };

    tick();
    schedulerTimer = window.setInterval(tick, RING_CYCLE_MS);
  },

  stop(): void {
    active = false;
    if (schedulerTimer !== null) {
      window.clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  },

  isActive(): boolean {
    return active;
  },
};
