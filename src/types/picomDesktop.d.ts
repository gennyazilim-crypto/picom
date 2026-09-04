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
  type PicomIncomingCallToastAction = "accept" | "decline" | "message";
  type PicomIncomingCallToastPayload = {
    inviteId: string;
    callId: string;
    conversationId: string;
    callerId: string;
    callerDisplayName: string;
    callerUsername?: string;
    callerAvatarPath?: string;
    callerAvatarUrl?: string;
    callerAvatarUpdatedAt?: string;
    callType: "voice" | "video";
    startedAt: string;
    subtitle?: string;
  };
  type PicomIncomingCallActionPayload = {
    action: PicomIncomingCallToastAction;
    inviteId: string;
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
  type PicomScreenCaptureDiagnostics = {
    displayCount: number;
    screenSourceCount: number;
    windowSourceCount?: number;
    incompleteDisplays: boolean;
  };
  type PicomPickedImageFile = {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  };
  type PicomUpdaterStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "download_failed"
    | "ready_to_install"
    | "install_failed"
    | "up_to_date"
    | "error"
    | "unsupported";
  type PicomUpdaterState = {
    status: PicomUpdaterStatus;
    enabled: boolean;
    version: string | null;
    releaseChannel: string;
    message: string;
    progress: number | null;
    checkedAt: string | null;
  };

  type PicomCompanionWindowType = "home" | "chat" | "voice" | "video" | "community" | "dock" | "bubble" | "settings" | "notification" | "gaming";
  type PicomCompanionWindowRequest = Readonly<{
    type: PicomCompanionWindowType;
    conversationId?: string;
    callId?: string;
    communityId?: string;
    channelId?: string;
  }>;
  type PicomCompanionPreferences = Readonly<{
    version: 1;
    startupMode: "main" | "companion";
    alwaysOnTop: boolean;
    compactDensity: boolean;
    closeToTray: boolean;
    showNotifications: boolean;
    theme: "system" | "light" | "dark";
    windowOpacity: number;
    dockEdge: "left" | "right" | "top" | "bottom";
    smartCollapse: boolean;
    dockAutoHide: boolean;
    gamingAutoDetect: boolean;
  }>;
  type PicomCompanionContext = Readonly<PicomCompanionWindowRequest & { key: string }>;
  interface Window {
    picomDesktop?: {
      companion: Readonly<{
        getContext: () => Promise<PicomCompanionContext | null>;
        enterMode: () => Promise<Readonly<{ key: string; created: boolean; mainWindowHidden: boolean }>>;
        openWindow: (request: PicomCompanionWindowRequest) => Promise<Readonly<{ key: string; created: boolean }>>;
        closeCurrent: () => Promise<boolean>;
        returnToMain: () => Promise<boolean>;
        getPreferences: () => Promise<PicomCompanionPreferences>;
        setPreferences: (preferences: Partial<Omit<PicomCompanionPreferences, "version">>) => Promise<PicomCompanionPreferences>;
        setAlwaysOnTop: (enabled: boolean) => Promise<PicomCompanionPreferences>;
        setDockLayout: (layout: "collapsed" | "rail" | "expanded") => Promise<Readonly<{ ok: boolean; layout?: "collapsed" | "rail" | "expanded" }>>;
        setWindowBounds: (bounds: Readonly<{ x?: number; y?: number; width?: number; height?: number; alwaysOnTop?: boolean }>) => Promise<Readonly<{ ok: boolean }>>;
        setClickThrough: (enabled: boolean) => Promise<Readonly<{ ok: boolean; enabled?: boolean }>>;
        broadcast: (event: Readonly<{ topic: string }>) => Promise<Readonly<{ topic: string; revision: number }>>;
        onSync: (listener: (event: Readonly<{ topic: string; revision: number }>) => void) => () => void;
      }>;
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
      notifications?: {
        getCapability: () => Promise<
          | { ok: true; native: true; supported: boolean }
          | { ok: false; native: true; error: string }
        >;
        /** Fixed-content test only; no renderer-provided notification payload. */
        sendTest: () => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
      };
      desktopNotificationToast?: {
        show: (payload: Readonly<{
          notificationId: string;
          type: "friend-request" | "friend-accepted" | "dm" | "friend-online" | "live";
          title: string;
          body: string;
          closeLabel: string;
          soundEnabled: boolean;
          accent: "indigo" | "teal" | "rose";
          primaryAction?: Readonly<{ action: "open" | "accept" | "decline" | "message" | "watch-live"; label: string }>;
          secondaryAction?: Readonly<{ action: "open" | "accept" | "decline" | "message" | "watch-live"; label: string }>;
        }>) => Promise<{ ok: true; native: true } | { ok: false; native: true; error: string }>;
        act: (payload: Readonly<{ action: "open" | "dismiss" | "accept" | "decline" | "message" | "watch-live"; notificationId: string }>) => Promise<{ ok: true; native: true } | { ok: false; native: true; error: string }>;
        onAction: (callback: (payload: Readonly<{ action: "open" | "dismiss" | "accept" | "decline" | "message" | "watch-live"; notificationId: string }>) => void) => () => void;
      };
      incomingCall?: {
        show: (
          payload: PicomIncomingCallToastPayload
        ) => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
        dismiss: () => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
        respond: (
          action: PicomIncomingCallToastAction
        ) => Promise<
          | { ok: true; native: true }
          | { ok: false; native: true; error: string }
        >;
        onAction: (callback: (payload: PicomIncomingCallActionPayload) => void) => () => void;
      };
      screenCapture?: {
        getSources: (request: { requestId: string; userInitiated: true }) => Promise<
          | {
              ok: true;
              native: true;
              requestId: string;
              sources: PicomScreenCaptureSource[];
              diagnostics?: PicomScreenCaptureDiagnostics;
            }
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
        setContentProtection?: (enabled: boolean) => Promise<
          | { ok: true; native: true; enabled: boolean }
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
      deepLinks?: {
        onOpen: (callback: (url: string) => void) => () => void;
      };
      power?: {
        onResume: (callback: (payload: { timestamp: string }) => void) => () => void;
      };
      updates?: {
        getState: () => Promise<
          | { ok: true; native: true; state: PicomUpdaterState }
          | { ok: false; native: true; error: string }
        >;
        check: () => Promise<
          | { ok: true; native: true; state: PicomUpdaterState }
          | { ok: false; native: true; error: string }
        >;
        download: () => Promise<
          | { ok: true; native: true; state: PicomUpdaterState }
          | { ok: false; native: true; error: string }
        >;
        install: () => Promise<
          | { ok: true; native: true; state: PicomUpdaterState }
          | { ok: false; native: true; error: string }
        >;
        onStateChange: (callback: (state: PicomUpdaterState) => void) => () => void;
      };
      activity?: {
        getSnapshot: () => Promise<
          | {
              ok: true;
              native: true;
              snapshot: Readonly<{
                kind: "none" | "game" | "music";
                statusText: string | null;
                source: string | null;
                title: string | null;
                detail: string | null;
                supported: boolean;
              }>;
            }
          | { ok: false; native: true; error: string }
        >;
      };
      settings?: {
        get: () => Promise<
          | { ok: true; native: true; settings: Record<string, unknown> }
          | { ok: false; native: true; error: string }
        >;
        set: (partial: Record<string, unknown>) => Promise<
          | { ok: true; native: true; settings: Record<string, unknown> }
          | { ok: false; native: true; error: string }
        >;
        reset: () => Promise<
          | { ok: true; native: true; settings: Record<string, unknown> }
          | { ok: false; native: true; error: string }
        >;
      };
      cache?: {
        getUsage: () => Promise<
          | {
              ok: true;
              native: true;
              usage: Readonly<{
                userDataBytes: number;
                cacheBytes: number;
                logsBytes: number;
                tempBytes: number;
              }>;
            }
          | { ok: false; native: true; error: string }
        >;
        clear: (scope?: "all" | "media") => Promise<
          | {
              ok: true;
              native: true;
              usage: Readonly<{
                userDataBytes: number;
                cacheBytes: number;
                logsBytes: number;
                tempBytes: number;
              }>;
            }
          | { ok: false; native: true; error: string }
        >;
      };
      appPaths?: {
        open: (target: "logs" | "downloads" | "userData") => Promise<
          | { ok: true; native: true; target: "logs" | "downloads" | "userData" }
          | { ok: false; native: true; error: string }
        >;
      };
    };
  }
}
