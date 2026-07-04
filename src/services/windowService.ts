export type WindowAction = "minimize" | "maximize" | "close";

export type WindowActionResult =
  | { ok: true; native: boolean; action: WindowAction }
  | { ok: false; native: boolean; action?: WindowAction; error: string };

export const windowService = {
  async run(action: WindowAction): Promise<WindowActionResult> {
    const nativeWindowControl = window.picomDesktop?.windowControl;

    if (!nativeWindowControl) {
      return { ok: true, native: false, action };
    }

    return nativeWindowControl(action);
  }
};