export type ShortcutAction = "commandPalette" | "settings" | "previousChannel" | "nextChannel" | "lockApp" | "escape";
export interface ShortcutBinding { label: string; action: ShortcutAction; }
export const shortcutService = {
  bindings: [
    { label: "Ctrl + K", action: "commandPalette" },
    { label: "Ctrl + ,", action: "settings" },
    { label: "Alt + Up", action: "previousChannel" },
    { label: "Alt + Down", action: "nextChannel" },
    { label: "Ctrl + Shift + L", action: "lockApp" },
    { label: "Escape", action: "escape" }
  ] satisfies ShortcutBinding[]
};
