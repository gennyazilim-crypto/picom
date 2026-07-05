export type MenuAction =
  | "open-settings"
  | "open-help"
  | "open-about"
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

  triggerPlaceholderAction(action: MenuAction): MenuActionPayload {
    const payload: MenuActionPayload = {
      action,
      source: "placeholder"
    };

    notify(payload);
    return payload;
  }
};
