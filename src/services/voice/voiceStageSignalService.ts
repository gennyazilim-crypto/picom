import type { MeetingReactionKind } from "../../types/meeting";
import { MEETING_REACTION_OPTIONS } from "../meeting/meetingReactionCatalog";
import { voiceService, type VoiceDataPacket } from "../voiceService";

const HAND_TOPIC = "picom.voice.hand";
const REACTION_TOPIC = "picom.voice.reaction";
const REACTION_TTL_MS = 2800;

export type VoiceStageReaction = Readonly<{
  id: string;
  senderIdentity: string;
  kind: MeetingReactionKind;
  expiresAt: string;
}>;

export type VoiceStageSignalSnapshot = Readonly<{
  raisedHands: Readonly<Record<string, boolean>>;
  reactions: readonly VoiceStageReaction[];
}>;

type Listener = () => void;

const listeners = new Set<Listener>();
const raisedHands = new Map<string, boolean>();
let reactions: VoiceStageReaction[] = [];
let revision = 0;
let expiryTimer: number | null = null;

function snapshot(): VoiceStageSignalSnapshot {
  return {
    raisedHands: Object.fromEntries(raisedHands),
    reactions: reactions.slice(),
  };
}

let cached = snapshot();

function notify() {
  revision += 1;
  cached = snapshot();
  listeners.forEach((listener) => listener());
  scheduleExpiry();
}

function scheduleExpiry() {
  if (expiryTimer != null) {
    window.clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  const now = Date.now();
  const next = reactions.reduce((nearest, reaction) => Math.min(nearest, Date.parse(reaction.expiresAt)), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(next) || next <= now) {
    const alive = reactions.filter((reaction) => Date.parse(reaction.expiresAt) > now);
    if (alive.length !== reactions.length) {
      reactions = alive;
      notify();
    }
    return;
  }
  expiryTimer = window.setTimeout(() => {
    expiryTimer = null;
    reactions = reactions.filter((reaction) => Date.parse(reaction.expiresAt) > Date.now());
    notify();
  }, Math.max(16, next - now + 16));
}

function decodePayload(payload: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }
}

function encodePayload(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function applyHand(identity: string, raised: boolean) {
  if (raised) raisedHands.set(identity, true);
  else raisedHands.delete(identity);
  notify();
}

function applyReaction(reaction: VoiceStageReaction) {
  reactions = [...reactions.filter((entry) => entry.id !== reaction.id), reaction].slice(-48);
  notify();
}

function onPacket(packet: VoiceDataPacket) {
  const body = decodePayload(packet.payload);
  if (!body || typeof body !== "object") return;

  if (packet.topic === HAND_TOPIC) {
    const raised = (body as { raised?: unknown }).raised === true;
    applyHand(packet.senderIdentity, raised);
    return;
  }

  if (packet.topic === REACTION_TOPIC) {
    const kind = (body as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !MEETING_REACTION_OPTIONS.some((option) => option.kind === kind)) return;
    const id = typeof (body as { id?: unknown }).id === "string"
      ? (body as { id: string }).id
      : `${packet.senderIdentity}:${packet.receivedAt}:${kind}`;
    applyReaction({
      id,
      senderIdentity: packet.senderIdentity,
      kind: kind as MeetingReactionKind,
      expiresAt: new Date(Date.parse(packet.receivedAt) + REACTION_TTL_MS).toISOString(),
    });
  }
}

function clearSignals() {
  if (!raisedHands.size && !reactions.length) return;
  raisedHands.clear();
  reactions = [];
  notify();
}

voiceService.subscribeDataPackets(onPacket);
voiceService.subscribe((state) => {
  if (state.status === "idle" || state.status === "disconnected" || state.status === "error") {
    clearSignals();
  }
});

export const voiceStageSignalService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): VoiceStageSignalSnapshot {
    return cached;
  },
  getRevision(): number {
    return revision;
  },
  isHandRaised(identity: string): boolean {
    return raisedHands.get(identity) === true;
  },
  async toggleHand(localIdentity: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const identity = voiceService.getLocalParticipantIdentity() ?? localIdentity;
    const next = !raisedHands.get(identity);
    applyHand(identity, next);
    const result = await voiceService.publishDataPacket(HAND_TOPIC, encodePayload({ raised: next }), true);
    if (!result.ok) {
      applyHand(identity, !next);
      return { ok: false, message: result.error.message };
    }
    return { ok: true };
  },
  async sendReaction(localIdentity: string, kind: MeetingReactionKind): Promise<{ ok: true } | { ok: false; message: string; retryAfterMs?: number }> {
    if (!MEETING_REACTION_OPTIONS.some((option) => option.kind === kind)) {
      return { ok: false, message: "Unknown reaction." };
    }
    const identity = voiceService.getLocalParticipantIdentity() ?? localIdentity;
    const id = `${identity}:${Date.now()}:${kind}`;
    const expiresAt = new Date(Date.now() + REACTION_TTL_MS).toISOString();
    applyReaction({ id, senderIdentity: identity, kind, expiresAt });
    // Reliable so remotes receive reactions the same way as raise-hand (lossy drops were silent).
    const result = await voiceService.publishDataPacket(REACTION_TOPIC, encodePayload({ id, kind }), true);
    if (!result.ok) {
      reactions = reactions.filter((entry) => entry.id !== id);
      notify();
      return { ok: false, message: result.error.message, retryAfterMs: 700 };
    }
    return { ok: true };
  },
};
