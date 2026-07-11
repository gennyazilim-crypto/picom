export type WindowAction = "minimize" | "maximize" | "close";

export type WindowActionResult =
  | { ok: true; native: true; action: WindowAction; maximized: boolean }
  | { ok: false; native: boolean; action?: WindowAction; error: string };

export type WindowMaximizeStateCallback = (isMaximized: boolean) => void;

export const windowService = {
  async run(action: WindowAction): Promise<WindowActionResult> {
    const nativeWindowControl = window.picomDesktop?.windowControl;

    if (!nativeWindowControl) {
      return { ok: false, native: false, action, error: "WINDOW_CONTROL_UNAVAILABLE" };
    }

    try {
      return await nativeWindowControl(action);
    } catch {
      return { ok: false, native: true, action, error: "WINDOW_CONTROL_FAILED" };
    }
  },

  async isMaximized(): Promise<boolean> {
    try {
      return await (window.picomDesktop?.isWindowMaximized?.() ?? Promise.resolve(false));
    } catch {
      return false;
    }
  },

  onMaximizeStateChanged(callback: WindowMaximizeStateCallback): () => void {
    try {
      return window.picomDesktop?.onWindowMaximizeStateChanged?.(callback) ?? (() => undefined);
    } catch {
      return () => undefined;
    }
  }
};
