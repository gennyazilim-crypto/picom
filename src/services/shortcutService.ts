export type ShortcutAction = "commandPalette" | "previousChannel" | "nextChannel" | "voiceMute" | "voiceDeafen" | "lockApp" | "escape";

export interface ShortcutBinding {
  action: ShortcutAction;
  actionLabel: string;
  description: string;
  label: string;
  configurable: boolean;
}

export type ShortcutUpdateResult =
  | { ok: true; bindings: ShortcutBinding[] }
  | { ok: false; reason: "CONFLICT" | "OS_RESERVED" | "INVALID"; message: string };

const storageKey = "picom:keyboard-shortcuts:v1";

const defaults: ShortcutBinding[] = [
  { action: "commandPalette", actionLabel: "Command Palette", description: "Open quick navigation and commands.", label: "Ctrl + K", configurable: true },
  { action: "previousChannel", actionLabel: "Previous channel", description: "Move to the previous visible channel.", label: "Alt + Up", configurable: true },
  { action: "nextChannel", actionLabel: "Next channel", description: "Move to the next visible channel.", label: "Alt + Down", configurable: true },
  { action: "voiceMute", actionLabel: "Mute / unmute microphone", description: "Toggle your microphone while connected to voice.", label: "Ctrl + Shift + M", configurable: true },
  { action: "voiceDeafen", actionLabel: "Deafen / undeafen", description: "Toggle incoming voice audio while connected.", label: "Ctrl + Shift + D", configurable: true },
  { action: "lockApp", actionLabel: "Lock app", description: "Hide sensitive content without ending the session.", label: "Ctrl + Shift + L", configurable: true },
  { action: "escape", actionLabel: "Close top overlay", description: "Close the topmost dialog, menu, or popover.", label: "Escape", configurable: false },
];

const reserved = new Set([
  "Alt+F4", "Control+Alt+Delete", "Control+F4", "Control+N", "Control+Q", "Control+R",
  "Control+Shift+I", "Control+Shift+J", "Control+Shift+R", "Control+T", "Control+W",
  "Alt+Tab", "Alt+Escape", "Control+Alt+Delete", "Control+Escape", "Control+Shift+Escape",
  "Meta+D", "Meta+E", "Meta+L", "Meta+M", "Meta+N", "Meta+Q", "Meta+Space", "Meta+Tab", "Meta+W",
]);

function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  if (key === "ArrowUp") return "Up";
  if (key === "ArrowDown") return "Down";
  if (key === "ArrowLeft") return "Left";
  if (key === "ArrowRight") return "Right";
  if (key.length === 1 && /[a-z]/i.test(key)) return key.toUpperCase();
  return key;
}

function canonicalFromLabel(label: string): string {
  const aliases: Record<string, string> = { Ctrl: "Control", Cmd: "Meta", Command: "Meta", Option: "Alt", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right" };
  return label.split("+").map((part) => part.trim()).map((part) => aliases[part] ?? normalizeKey(part)).join("+");
}

function labelFromCanonical(canonical: string): string {
  const aliases: Record<string, string> = { Control: "Ctrl", Meta: "Cmd" };
  return canonical.split("+").map((part) => aliases[part] ?? part).join(" + ");
}

function eventCanonical(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Control");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const key = normalizeKey(event.key);
  if (!["Control", "Meta", "Alt", "Shift"].includes(key)) parts.push(key);
  return parts.join("+");
}

function cloneDefaults(): ShortcutBinding[] {
  return defaults.map((binding) => ({ ...binding }));
}

function readBindings(): ShortcutBinding[] {
  if (typeof localStorage === "undefined") return cloneDefaults();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, unknown>;
    return defaults.map((binding) => {
      const candidate = stored[binding.action];
      if (!binding.configurable || typeof candidate !== "string") return { ...binding };
      const canonical = canonicalFromLabel(candidate);
      return canonical && !reserved.has(canonical) ? { ...binding, label: labelFromCanonical(canonical) } : { ...binding };
    });
  } catch {
    return cloneDefaults();
  }
}

function persist(bindings: ShortcutBinding[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(bindings.map(({ action, label }) => [action, label]))));
  window.dispatchEvent(new CustomEvent("picom:shortcuts-changed"));
}

export const shortcutService = {
  get bindings(): ShortcutBinding[] { return readBindings(); },
  getBindings(): ShortcutBinding[] { return readBindings(); },
  matchesEvent(action: ShortcutAction, event: KeyboardEvent): boolean {
    const binding = readBindings().find((candidate) => candidate.action === action);
    return Boolean(binding && canonicalFromLabel(binding.label) === eventCanonical(event));
  },
  bindingFromKeyboardEvent(event: KeyboardEvent): string | null {
    const canonical = eventCanonical(event);
    const parts = canonical.split("+");
    const key = parts[parts.length - 1] ?? "";
    if (!key || ["Control", "Meta", "Alt", "Shift"].includes(key)) return null;
    if (key !== "Escape" && !event.ctrlKey && !event.metaKey && !event.altKey) return null;
    return labelFromCanonical(canonical);
  },
  updateBinding(action: ShortcutAction, label: string): ShortcutUpdateResult {
    const bindings = readBindings();
    const target = bindings.find((binding) => binding.action === action);
    if (!target?.configurable) return { ok: false, reason: "INVALID", message: "This safety shortcut cannot be changed." };
    const canonical = canonicalFromLabel(label);
    if (!canonical || canonical.split("+").length < 2) return { ok: false, reason: "INVALID", message: "Use Ctrl, Cmd, or Alt with another key." };
    if (reserved.has(canonical)) return { ok: false, reason: "OS_RESERVED", message: "That shortcut is reserved by the operating system or desktop runtime." };
    const conflict = bindings.find((binding) => binding.action !== action && canonicalFromLabel(binding.label) === canonical);
    if (conflict) return { ok: false, reason: "CONFLICT", message: `Already assigned to ${conflict.actionLabel}.` };
    target.label = labelFromCanonical(canonical);
    persist(bindings);
    return { ok: true, bindings };
  },
  resetDefaults(): ShortcutBinding[] {
    const bindings = cloneDefaults();
    persist(bindings);
    return bindings;
  },
  isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  },
};
