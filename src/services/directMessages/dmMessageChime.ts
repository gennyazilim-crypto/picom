// Short DM arrival cue synthesized with WebAudio (no bundled asset, CSP-safe).

let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

const NOTE_GAIN = 0.11;
const MIN_GAP_MS = 450;

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

export const dmMessageChime = {
  /** Soft two-note ping when an incoming DM lands in the open conversation. */
  playIncoming(): void {
    const now = Date.now();
    if (now - lastPlayedAt < MIN_GAP_MS) return;
    lastPlayedAt = now;

    const ctx = getContext();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);

    const start = ctx.currentTime + 0.01;
    const tones = [880, 1174.66] as const;
    tones.forEach((frequency, index) => {
      const at = start + index * 0.07;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(NOTE_GAIN, at + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      oscillator.connect(envelope).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.14);
    });
  },
};
