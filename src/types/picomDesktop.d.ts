export {};

declare global {
  type PicomWindowAction = "minimize" | "maximize" | "close";
  type PicomNativeNotificationPayload = {
    title: string;
    body?: string;
    tag?: string;
    silent?: boolean;
  };
  type PicomTrayStatus = "online" | "idle" | "dnd" | "invisible";
  type PicomTrayAction = "open" | "settings" | "mute" | "quit" | PicomTrayStatus;
  type PicomTrayActionPayload = {
    action: PicomTrayAction;
    status: PicomTrayStatus;
    muted: boolean;
  };
  type PicomScreenCaptureSource = {
    id: string;
    name: string;
    type: "screen" | "window";
    thumbnailDataUrl: string | null;
    appIconDataUrl: string | null;
  };

  interface Window {
    picomDesktop?: {
      getRuntimeInfo: () => {
        runtime: "electron";
        platform: string;
        versions: {
          electron?: string;
          chrome?: string;
          node?: string;
        };
      };
      windowControl: (
        action: PicomWindowAction
      ) => Promise<
        | { ok: true; native: true; action: PicomWindowAction }
        | { ok: false; native: true; error: string }
      >;
      isWindowMaximized?: () => Promise<boolean>;
      onWindowMaximizeStateChanged?: (callback: (isMaximized: boolean) => void) => () => void;
      showNotification?: (
        payload: PicomNativeNotificationPayload
      ) => Promise<
        | { ok: true; native: true }
        | { ok: false; native: true; error: string }
      >;
      screenCapture?: {
        getSources: () => Promise<
          | { ok: true; native: true; sources: PicomScreenCaptureSource[] }
          | { ok: false; native: true; error: string }
        >;
      };
      tray?: {
        setStatus: (
          status: PicomTrayStatus
        ) => Promise<
          | { ok: true; native: true; status: PicomTrayStatus }
          | { ok: false; native: true; error: string }
        >;
        setMuted: (
          muted: boolean
        ) => Promise<
          | { ok: true; native: true; muted: boolean }
          | { ok: false; native: true; error: string }
        >;
        showWindow: () => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
        quit: () => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
        onAction: (callback: (payload: PicomTrayActionPayload) => void) => () => void;
      };
    };
  }
}
