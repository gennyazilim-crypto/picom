export {};

declare global {
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
    };
  }
}