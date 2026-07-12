import type { PresencePreference } from "../../types/presence";

const STORAGE_KEY = "picom.presence.preference.v1";
const listeners = new Set<(preference: PresencePreference) => void>();

function normalize(value: unknown): PresencePreference {
  return value === "idle" || value === "dnd" || value === "invisible" ? value : "online";
}

function read(): PresencePreference {
  try {
    return typeof window === "undefined" ? "online" : normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "online";
  }
}

let currentPreference = read();

function publish(preference: PresencePreference): void {
  currentPreference = preference;
  for (const listener of listeners) listener(preference);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) publish(normalize(event.newValue));
  });
}

export const presencePreferenceService = {
  get(): PresencePreference {
    return currentPreference;
  },
  set(preference: PresencePreference): PresencePreference {
    const normalized = normalize(preference);
    try { window.localStorage.setItem(STORAGE_KEY, normalized); } catch { /* restricted storage fallback */ }
    publish(normalized);
    return normalized;
  },
  subscribe(listener: (preference: PresencePreference) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
