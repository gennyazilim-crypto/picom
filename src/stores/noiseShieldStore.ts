import type { NoiseShieldSnapshot } from "../types/noiseShield";

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: NoiseShieldSnapshot = { scope: null, roomId: null, requestedMode: "off", appliedMode: "off", availableModes: ["off"], provider: "none", status: "off", fallbackReason: null, revision: 0, lastAppliedAt: null };

export const noiseShieldStore = {
  getSnapshot: (): NoiseShieldSnapshot => snapshot,
  subscribe(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  patch(patch: Partial<NoiseShieldSnapshot>): NoiseShieldSnapshot { snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 }; listeners.forEach((listener) => listener()); return snapshot; },
  reset(): NoiseShieldSnapshot { snapshot = { ...snapshot, scope: null, roomId: null, appliedMode: "off", status: "off", fallbackReason: null, lastAppliedAt: null, revision: snapshot.revision + 1 }; listeners.forEach((listener) => listener()); return snapshot; },
};
