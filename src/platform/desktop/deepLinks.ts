import type { DeepLinkAdapter } from "../types";

export const desktopDeepLinks: DeepLinkAdapter = {
  mode: "native",
  startListening(handler) {
    const bridge = window.picomDesktop?.deepLinks;
    if (!bridge?.onOpen) return () => undefined;
    return bridge.onOpen((url) => handler(url));
  },
};
