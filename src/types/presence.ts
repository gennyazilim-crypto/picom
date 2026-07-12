import type { UserStatus } from "./community";

export type PresencePreference = "online" | "idle" | "dnd" | "invisible";
export type PresenceConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export type GlobalPresenceSnapshot = Readonly<{
  preference: PresencePreference;
  connection: PresenceConnectionState;
  publicStatus: UserStatus;
  dotStatus: UserStatus;
  label: "Online" | "Idle" | "Do Not Disturb" | "Invisible" | "Offline";
  visibleToOthers: boolean;
  error: string | null;
}>;
