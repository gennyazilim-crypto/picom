export {};

declare global {
  type PicomWindowAction = "minimize" | "maximize" | "close";

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
    };
  }
}