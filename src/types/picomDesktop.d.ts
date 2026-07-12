export {};

declare global {
  type PicomWindowAction = "minimize" | "maximize" | "close";
  type PicomNativeNotificationPayload = {
    title: string;
    body?: string;
    tag?: string;
    silent?: boolean;
    deepLink?: string;
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
  type PicomPickedImageFile = {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  };

  type PicomOAuthProvider = "google" | "apple" | "epic" | "steam";
  type PicomOAuthPurpose = "sign_in" | "link";
  type PicomSecureAuthStorageStatus = {
    mode: "os_protected" | "memory_only";
    persistent: boolean;
    backend: string;
    reason?: "OS_PROTECTED_STORAGE_UNAVAILABLE";
  };
  type PicomOAuthAttempt = {
    attemptId: string;
    provider: PicomOAuthProvider;
    purpose: PicomOAuthPurpose;
    redirectUrl: string;
    expiresAt: number;
    storage: PicomSecureAuthStorageStatus;
  };
  type PicomOAuthCompletionResult = {
    resultId: string;
    attemptId: string;
    provider: PicomOAuthProvider;
    purpose: PicomOAuthPurpose;
    status: "success" | "error";
    code?: string;
    error?: "OAUTH_PROVIDER_CANCELLED" | "OAUTH_PROVIDER_ERROR";
    receivedAt: number;
    expiresAt: number;
  };
  type PicomOAuthDelivery = PicomOAuthCompletionResult | { status: "rejected"; error: string };

  type PicomOAuthProvider = "google" | "apple" | "epic" | "steam";
  type PicomOAuthPurpose = "sign_in" | "link";
  type PicomSecureAuthStorageStatus = {
    mode: "os_protected" | "memory_only";
    persistent: boolean;
    backend: string;
    reason?: "OS_PROTECTED_STORAGE_UNAVAILABLE";
  };
  type PicomOAuthAttempt = {
    attemptId: string;
    provider: PicomOAuthProvider;
    purpose: PicomOAuthPurpose;
    redirectUrl: string;
    expiresAt: number;
    storage: PicomSecureAuthStorageStatus;
  };
  type PicomOAuthCompletionResult = {
    resultId: string;
    attemptId: string;
    provider: PicomOAuthProvider;
    purpose: PicomOAuthPurpose;
    status: "success" | "error";
    code?: string;
    error?: "OAUTH_PROVIDER_CANCELLED" | "OAUTH_PROVIDER_ERROR";
    receivedAt: number;
    expiresAt: number;
  };
  type PicomOAuthDelivery = PicomOAuthCompletionResult | { status: "rejected"; error: string };

  interface Window {
    picomDesktop?: {
      contractVersion: 1;
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
        | { ok: true; native: true; action: PicomWindowAction; maximized: boolean }
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
        getSources: (request: { requestId: string; userInitiated: true }) => Promise<
          | { ok: true; native: true; requestId: string; sources: PicomScreenCaptureSource[] }
          | { ok: false; native: true; error: string; platform?: string }
        >;
        selectSource: (request: { requestId: string; sourceId: string }) => Promise<
          | { ok: true; native: true; source: Pick<PicomScreenCaptureSource, "id" | "name" | "type"> }
          | { ok: false; native: true; error: string }
        >;
        cancelSelection: (request: { requestId: string }) => Promise<
          | { ok: true; native: true; canceled: true }
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
        setCloseToTray: (
          enabled: boolean
        ) => Promise<
          | { ok: true; native: true; enabled: boolean; supported: boolean }
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
      startup?: {
        getState: () => Promise<
          | { ok: true; native: true; supported: boolean; enabled: boolean }
          | { ok: false; native: true; error: string }
        >;
        setEnabled: (enabled: boolean) => Promise<
          | { ok: true; native: true; supported: true; enabled: boolean }
          | { ok: false; native: true; error: string }
        >;
      };
      file?: {
        pickImages: () => Promise<
          | { ok: true; native: true; canceled: boolean; files: PicomPickedImageFile[] }
          | { ok: false; native: true; error: string }
        >;
        saveText: (
          payload: { defaultPath?: string; content: string }
        ) => Promise<
          | { ok: true; native: true; canceled: boolean }
          | { ok: false; native: true; error: string }
        >;
      };
      clipboard?: {
        readText: () => Promise<
          | { ok: true; native: true; text: string }
          | { ok: false; native: true; error: string }
        >;
        writeText: (
          text: string
        ) => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
      };
      externalLinks?: {
        openUrl: (
          url: string
        ) => Promise<
          | { ok: true; native: true; url: string }
          | { ok: false; native: true; error: string }
        >;
      };
      auth?: {
        startOAuthAttempt: (request: { provider: PicomOAuthProvider; purpose: PicomOAuthPurpose }) => Promise<
          | { ok: true; native: true; attempt: PicomOAuthAttempt }
          | { ok: false; native: true; error: string }
        >;
        cancelOAuthAttempt: (attemptId: string) => Promise<{ ok: boolean; native: true; error?: string }>;
        getPendingOAuthResult: () => Promise<
          | { ok: true; native: true; result: PicomOAuthCompletionResult | null }
          | { ok: false; native: true; error: string }
        >;
        acknowledgeOAuthResult: (resultId: string) => Promise<{ ok: boolean; native: true; error?: string }>;
        onOAuthResult: (callback: (result: PicomOAuthDelivery) => void) => () => void;
        secureStorage: {
          getItem: (key: string) => Promise<{ ok: true; native: true; value: string | null } | { ok: false; native: true; error: string }>;
          setItem: (key: string, value: string) => Promise<{ ok: true; native: true } | { ok: false; native: true; error: string }>;
          removeItem: (key: string) => Promise<{ ok: true; native: true } | { ok: false; native: true; error: string }>;
          getStatus: () => Promise<{ ok: true; native: true; status: PicomSecureAuthStorageStatus } | { ok: false; native: true; error: string }>;
        };
      };
      deepLinks?: {
        onOpen: (callback: (url: string) => void) => () => void;
      };
      power?: {
        onResume: (callback: (payload: { timestamp: string }) => void) => () => void;
      };
    };
  }
}
