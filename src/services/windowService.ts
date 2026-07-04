export type WindowAction = "minimize" | "maximize" | "close";
export const windowService = {
  run(action: WindowAction) {
    console.info(`[picom window placeholder] ${action}`);
    return { ok: true, native: false, action };
  }
};