import { loggingService } from "./loggingService";
import { desktopBehaviorService } from "./desktop/desktopBehaviorService";

export type TrayAction = "open" | "settings" | "mute" | "quit" | "online" | "idle" | "dnd" | "invisible";
export type TrayStatus = "online" | "idle" | "dnd" | "invisible";
function getNativeTrayBridge() {
  return window.picomDesktop?.tray ?? null;
}

export const trayService = {
  isNativeAvailable(): boolean {
    return Boolean(getNativeTrayBridge());
  },

  setStatus(status: TrayStatus) {
    const bridge = getNativeTrayBridge();
    if (!bridge) return Promise.resolve({ ok: true, native: false, action: status });
    return bridge.setStatus(status);
  },

  setMuted(muted: boolean) {
    const bridge = getNativeTrayBridge();
    if (!bridge) return Promise.resolve({ ok: true, native: false, action: "mute" as const, muted });
    return bridge.setMuted(muted);
  },

  getCloseToTrayEnabled(): boolean {
    return desktopBehaviorService.getState().closeBehavior === "tray";
  },

  async setCloseToTrayEnabled(enabled: boolean) {
    const state = await desktopBehaviorService.updatePreferences({ closeBehavior: enabled ? "tray" : "quit" });
    const applied = state.closeBehavior === (enabled ? "tray" : "quit");
    return {
      ok: applied,
      native: Boolean(getNativeTrayBridge()),
      enabled: state.closeBehavior === "tray",
      supported: state.trayAvailable,
    } as const;
  },

  async syncCloseToTrayPreference() {
    const state = await desktopBehaviorService.refresh();
    return {
      ok: true,
      native: Boolean(getNativeTrayBridge()),
      enabled: state.closeBehavior === "tray",
      supported: state.trayAvailable,
    } as const;
  },

  showWindow() {
    const bridge = getNativeTrayBridge();
    if (!bridge) return Promise.resolve({ ok: true, native: false, action: "open" as const });
    return bridge.showWindow();
  },

  quit() {
    const bridge = getNativeTrayBridge();
    if (!bridge) return Promise.resolve({ ok: true, native: false, action: "quit" as const });
    return bridge.quit();
  },

  onAction(callback: (payload: PicomTrayActionPayload) => void) {
    return getNativeTrayBridge()?.onAction(callback) ?? (() => undefined);
  },

  simulate(action: TrayAction) {
    loggingService.logInfo("Tray placeholder action simulated", { action }, "tray");
    return { ok: true, native: false, action };
  }
};
