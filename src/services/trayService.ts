export type TrayAction = "open" | "settings" | "mute" | "quit" | "online" | "idle" | "dnd" | "invisible";
export const trayService = {
  simulate(action: TrayAction) {
    console.info(`[picom tray placeholder] ${action}`);
    return { ok: true, native: false, action };
  }
};