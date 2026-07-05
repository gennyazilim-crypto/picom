export type MenuAction =
  | "open-settings"
  | "open-command-palette"
  | "open-mention-feed"
  | "open-direct-messages"
  | "open-friends"
  | "open-help"
  | "open-about"
  | "open-system-status"
  | "send-feedback"
  | "export-diagnostics"
  | "quit";

export type MenuActionPayload = Readonly<{
  action: MenuAction;
  source: "placeholder" | "native";
}>;

export type MenuServiceState = Readonly<{
  nativeMenuVisible: false;
  placeholder: true;
  reason: string;
}>;

type MenuActionListener = (payload: MenuActionPayload) => void;

const listeners = new Set<MenuActionListener>();
const menuLabels: Record<MenuAction, string> = {
  "open-settings": "Open Settings",
  "open-command-palette": "Open Command Palette",
  "open-mention-feed": "Open Mention Feed",
  "open-direct-messages": "Open Direct Messages",
  "open-friends": "Open Friends",
  "open-help": "Open Help",
  "open-about": "Open About",
  "open-system-status": "Open System Status",
  "send-feedback": "Send Feedback",
  "export-diagnostics": "Export Diagnostics",
  quit: "Quit Picom"
};

function notify(payload: MenuActionPayload): void {
  for (const listener of listeners) {
    listener(payload);
  }
}

export const menuService = {
  getState(): MenuServiceState {
    return {
      nativeMenuVisible: false,
      placeholder: true,
      reason: "Picom uses a custom titlebar; the native application menu is intentionally hidden for MVP."
    };
  },

  onAction(listener: MenuActionListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  getPlaceholderActions(): ReadonlyArray<Readonly<{ action: MenuAction; label: string }>> {
    return Object.entries(menuLabels).map(([action, label]) => ({
      action: action as MenuAction,
      label
    }));
  },

  triggerPlaceholderAction(action: MenuAction): MenuActionPayload {
    const payload: MenuActionPayload = {
      action,
      source: "placeholder"
    };

    notify(payload);
    return payload;
  }
};
