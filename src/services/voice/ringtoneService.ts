// Synthesized incoming-call ringtone via the WebAudio API. Using an oscillator
// pattern instead of a bundled audio file keeps the ringtone CSP-safe and avoids
// shipping a binary asset. If the audio context cannot start (e.g. autoplay policy
// before any user gesture) the call still surfaces via the visual overlay and the
// native OS notification, so a blocked ringtone never hides an incoming call.

let audioContext: AudioContext | null = null;
let schedulerTimer: number | null = null;
let unlockCleanup: (() => void) | null = null;
let active = false;

const RING_CYCLE_MS = 3200;
const TONE_GAIN = 0.2;

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

function clearUnlockListeners(): void {
  unlockCleanup?.();
  unlockCleanup = null;
}

function armUnlockListeners(ctx: AudioContext): void {
  if (typeof window === "undefined" || unlockCleanup) return;
  if (ctx.state === "running") return;

  const unlock = () => {
    void ctx.resume().then(() => {
      if (active && ctx.state === "running") {
        playRingBurst(ctx, ctx.currentTime + 0.02);
      }
      clearUnlockListeners();
    }).catch(() => undefined);
  };

  const options: AddEventListenerOptions = { once: true, capture: true };
  window.addEventListener("pointerdown", unlock, options);
  window.addEventListener("keydown", unlock, options);
  unlockCleanup = () => {
    window.removeEventListener("pointerdown", unlock, options);
    window.removeEventListener("keydown", unlock, options);
  };
}

function playRingBurst(ctx: AudioContext, startAt: number): void {
  // Classic double-ring: two short pairs of dual-tone bursts, then silence.
  const bursts: ReadonlyArray<{ offset: number; frequencies: readonly [number, number] }> = [
    { offset: 0, frequencies: [440, 480] },
    { offset: 0.42, frequencies: [440, 480] },
    { offset: 1.2, frequencies: [440, 480] },
    { offset: 1.62, frequencies: [440, 480] },
  ];

  for (const burst of bursts) {
    for (const frequency of burst.frequencies) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = startAt + burst.offset;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(TONE_GAIN, at + 0.02);
      gain.gain.setValueAtTime(TONE_GAIN, at + 0.28);
      gain.gain.linearRampToValueAtTime(0, at + 0.34);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.36);
    }
  }
}

export const ringtoneService = {
  start(): void {
    if (active) return;
    const ctx = getContext();
    if (!ctx) return;
    active = true;
    void ctx.resume().catch(() => undefined);
    armUnlockListeners(ctx);

    const tick = () => {
      if (!active) return;
      const context = getContext();
      if (!context || context.state !== "running") return;
      playRingBurst(context, context.currentTime + 0.05);
    };

    tick();
    schedulerTimer = window.setInterval(tick, RING_CYCLE_MS);
  },

  stop(): void {
    active = false;
    clearUnlockListeners();
    if (schedulerTimer !== null) {
      window.clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  },

  isActive(): boolean {
    return active;
  },
};
