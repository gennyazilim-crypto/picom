import { loggingService } from "./loggingService";

export type TrayAction = "open" | "settings" | "mute" | "quit" | "online" | "idle" | "dnd" | "invisible";
export type TrayStatus = "online" | "idle" | "dnd" | "invisible";
const CLOSE_TO_TRAY_KEY = "picom.tray.closeToTray.v1";

function readCloseToTrayPreference(): boolean {
  try { return window.localStorage.getItem(CLOSE_TO_TRAY_KEY) === "true"; } catch { return false; }
}

function writeCloseToTrayPreference(enabled: boolean): void {
  try { window.localStorage.setItem(CLOSE_TO_TRAY_KEY, String(enabled)); } catch { /* safe restricted fallback */ }
}

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
    return readCloseToTrayPreference();
  },

  async setCloseToTrayEnabled(enabled: boolean) {
    writeCloseToTrayPreference(enabled);
    const bridge = getNativeTrayBridge();
    if (!bridge?.setCloseToTray) return { ok: true, native: false, enabled, supported: false } as const;
    return bridge.setCloseToTray(enabled);
  },

  syncCloseToTrayPreference() {
    return this.setCloseToTrayEnabled(readCloseToTrayPreference());
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
