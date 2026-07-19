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
    };
  }
}
