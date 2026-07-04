export {};

declare global {
  interface Window {
    picomDesktop?: {
      runtime: "electron";
      platform: string;
      versions: {
        electron?: string;
        chrome?: string;
        node?: string;
      };
    };
  }
}