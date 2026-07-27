type DesktopPwaRegistrationOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (
    serviceWorkerUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
  onRegisterError?: (error: unknown) => void;
};

/**
 * Electron does not register a browser service worker. This adapter exists so
 * Vite's desktop dependency scan can safely resolve the web-only virtual module.
 */
export function registerSW(
  _options: DesktopPwaRegistrationOptions = {},
): (reloadPage?: boolean) => Promise<void> {
  return async () => undefined;
}
