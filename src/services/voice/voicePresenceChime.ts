// Short join/leave chimes for voice rooms, synthesized with WebAudio (no bundled
// asset, CSP-safe). The sound is played locally on each client in
// response to LiveKit participant events, so everyone in the room hears a peer
// connect/disconnect without any audio being sent through the room itself.

let audioContext: AudioContext | null = null;

const NOTE_GAIN = 0.14;
const NOTE_DURATION_SEC = 0.13;

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

function playSequence(frequencies: readonly number[]): void {
  const ctx = getContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);

  let at = ctx.currentTime + 0.02;
  for (const frequency of frequencies) {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(NOTE_GAIN, at + 0.02);
    envelope.gain.linearRampToValueAtTime(0, at + NOTE_DURATION_SEC);
    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_DURATION_SEC + 0.02);
    at += NOTE_DURATION_SEC;
  }
}

export const voicePresenceChime = {
  // Ascending two-note cue when a participant connects.
  playJoin(): void {
    playSequence([523.25, 783.99]);
  },
  // Descending two-note cue when a participant disconnects.
  playLeave(): void {
    playSequence([783.99, 523.25]);
  },
};
