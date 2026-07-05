export {};

declare global {
  type PicomWindowAction = "minimize" | "maximize" | "close";
  type PicomNativeNotificationPayload = {
    title: string;
    body?: string;
    tag?: string;
    silent?: boolean;
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
    };
  }
}
