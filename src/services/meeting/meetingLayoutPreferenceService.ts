import type { MeetingLayoutMode } from "../../types/meeting";
import type { MeetingClientSnapshot } from "../../types/meetingClient";

export type MeetingLayoutPreference = "auto" | MeetingLayoutMode;
export type MeetingLayoutPreferenceSnapshot = Readonly<{ roomId: string | null; preference: MeetingLayoutPreference }>;

const listeners = new Set<() => void>();
let state: MeetingLayoutPreferenceSnapshot = { roomId: null, preference: "auto" };
const storageKey = (roomId: string) => `picom.meeting.layout.${roomId}`;
const isPreference = (value: string | null): value is MeetingLayoutPreference => value === "auto" || value === "grid" || value === "speaker" || value === "screen_share" || value === "stage";
const publish = (next: MeetingLayoutPreferenceSnapshot) => { state = next; listeners.forEach((listener) => listener()); };

function readPreference(roomId: string): MeetingLayoutPreference {
  try { const value = window.sessionStorage.getItem(storageKey(roomId)); return isPreference(value) ? value : "auto"; } catch { return "auto"; }
}

function writePreference(roomId: string, preference: MeetingLayoutPreference): void {
  try { window.sessionStorage.setItem(storageKey(roomId), preference); } catch { /* Session-local persistence is optional when storage is unavailable. */ }
}

export function getValidMeetingLayoutPreferences(snapshot: MeetingClientSnapshot): readonly MeetingLayoutPreference[] {
  const valid: MeetingLayoutPreference[] = ["auto", "grid"];
  if (snapshot.participantIds.length) valid.push("speaker");
  if ((snapshot.screenShares?.length ?? 0) > 0) valid.push("screen_share");
  if (snapshot.context?.roomMode === "stage") valid.push("stage");
  return valid;
}

export function resolveMeetingLayout(snapshot: MeetingClientSnapshot, preference: MeetingLayoutPreference): MeetingLayoutMode {
  if (preference !== "auto" && getValidMeetingLayoutPreferences(snapshot).includes(preference)) return preference;
  if ((snapshot.screenShares?.length ?? 0) > 0) return "screen_share";
  if (snapshot.context?.roomMode === "stage") return "stage";
  return "grid";
}

export const meetingLayoutPreferenceService = {
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot(): MeetingLayoutPreferenceSnapshot { return state; },
  activate(roomId: string): void { if (state.roomId !== roomId) publish({ roomId, preference: readPreference(roomId) }); },
  setPreference(preference: MeetingLayoutPreference): void { if (state.preference === preference) return; if (state.roomId) writePreference(state.roomId, preference); publish({ ...state, preference }); },
  reset(): void { this.setPreference("auto"); },
};
