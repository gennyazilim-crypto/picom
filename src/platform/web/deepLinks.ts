import type { DeepLinkAdapter } from "../types";

export const webDeepLinks: DeepLinkAdapter = {
  mode: "https",
  startListening(handler) {
    // Auth / recovery callbacks land as HTTPS URLs; popstate covers SPA back/forward.
    const onPop = () => handler(window.location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  },
};
