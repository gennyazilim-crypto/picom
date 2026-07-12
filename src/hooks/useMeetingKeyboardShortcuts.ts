import { useEffect, useRef, useState } from "react";

export type MeetingShortcutPanel = "people" | "chat";

type MeetingKeyboardShortcutActions = Readonly<{
  enabled: boolean;
  onOpenPanel: (panel: MeetingShortcutPanel) => void;
  onCycleLayout: () => void;
}>;

type MeetingControlShortcut = "microphone" | "camera" | "screen-share" | "hand";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='textbox']";
const BLOCKING_OVERLAY_SELECTOR = "[aria-modal='true'], .desktop-context-menu, .meeting-control-menu";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));
}

function controlButton(action: MeetingControlShortcut): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-meeting-shortcut-action="${action}"]`);
}

export function useMeetingKeyboardShortcuts({ enabled, onOpenPanel, onCycleLayout }: MeetingKeyboardShortcutActions): string {
  const [announcement, setAnnouncement] = useState("");
  const clearTimer = useRef<number | null>(null);
  const actions = useRef({ onOpenPanel, onCycleLayout });
  actions.current = { onOpenPanel, onCycleLayout };

  useEffect(() => () => {
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const announce = (message: string) => {
      setAnnouncement("");
      window.requestAnimationFrame(() => setAnnouncement(message));
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setAnnouncement(""), 4_000);
    };
    const activateControl = (action: MeetingControlShortcut) => {
      const button = controlButton(action);
      if (!button || button.disabled) {
        announce("That meeting control is currently unavailable.");
        return;
      }
      const label = button.getAttribute("aria-label") ?? "Meeting control";
      button.click();
      announce(`${label} activated.`);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      if (document.querySelector(BLOCKING_OVERLAY_SELECTOR)) return;

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        const leaveButton = document.querySelector<HTMLButtonElement>('[data-meeting-shortcut-action="leave"]');
        if (!leaveButton) return;
        event.preventDefault();
        leaveButton.focus();
        announce("Leave meeting control focused. Press Enter to leave.");
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        announce("Meeting shortcuts: M microphone, V camera, S share, H hand, C chat, P people, L layout, Control Shift L leave.");
        return;
      }
      const controls: Partial<Record<string, MeetingControlShortcut>> = { m: "microphone", v: "camera", s: "screen-share", h: "hand" };
      const control = controls[key];
      if (control) {
        event.preventDefault();
        activateControl(control);
        return;
      }
      if (key === "c" || key === "p") {
        event.preventDefault();
        const panel: MeetingShortcutPanel = key === "c" ? "chat" : "people";
        actions.current.onOpenPanel(panel);
        window.requestAnimationFrame(() => document.getElementById("meeting-side-panel")?.focus());
        announce(`${panel === "chat" ? "Chat" : "People"} panel opened.`);
        return;
      }
      if (key === "l") {
        event.preventDefault();
        actions.current.onCycleLayout();
        announce("Meeting layout changed.");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  return announcement;
}
