export type PlatformKind = "desktop" | "web";

export type PlatformCapabilities = Readonly<{
  notifications: boolean;
  clipboard: boolean;
  filePicker: boolean;
  windowControls: boolean;
  tray: boolean;
  companionNative: boolean;
  deepLinksNative: boolean;
  screenCaptureNative: boolean;
  screenCaptureBrowser: boolean;
  updates: boolean;
  activityPresence: boolean;
  pwa: boolean;
}>;

export type PlatformResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; code: string; message: string; desktopOnly?: boolean }>;

export type NotificationAdapter = Readonly<{
  isAvailable(): boolean;
  requestPermission(): Promise<"granted" | "denied" | "default">;
  show(input: Readonly<{ title: string; body?: string; tag?: string }>): Promise<PlatformResult<true>>;
}>;

export type ClipboardAdapter = Readonly<{
  writeText(text: string): Promise<PlatformResult<true>>;
  readText(): Promise<PlatformResult<string>>;
}>;

export type FilePickerAdapter = Readonly<{
  pickFiles(options?: Readonly<{ accept?: string; multiple?: boolean }>): Promise<PlatformResult<File[]>>;
}>;

export type WindowAdapter = Readonly<{
  isAvailable(): boolean;
  minimize(): Promise<PlatformResult<true>>;
  maximize(): Promise<PlatformResult<true>>;
  close(): Promise<PlatformResult<true>>;
}>;

export type DeepLinkAdapter = Readonly<{
  mode: "native" | "https";
  startListening(handler: (url: string) => void): () => void;
}>;

export type StorageAdapter = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}>;

export type MediaPermissionAdapter = Readonly<{
  queryMicrophone(): Promise<PermissionState | "unknown">;
  queryCamera(): Promise<PermissionState | "unknown">;
  getUserMedia(constraints: MediaStreamConstraints): Promise<PlatformResult<MediaStream>>;
}>;

export type ScreenShareAdapter = Readonly<{
  mode: "native" | "browser" | "unavailable";
  /** Electron: list picker sources. Browser: returns a single synthetic browser:display entry. */
  listSources(): Promise<PlatformResult<ReadonlyArray<{ id: string; name: string; type: "screen" | "window" }>>>;
  /** Browser-only: acquire getDisplayMedia stream (user gesture required). */
  acquireDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<PlatformResult<MediaStream>>;
}>;

export type PlatformAdapter = Readonly<{
  kind: PlatformKind;
  capabilities: PlatformCapabilities;
  notifications: NotificationAdapter;
  clipboard: ClipboardAdapter;
  filePicker: FilePickerAdapter;
  window: WindowAdapter;
  deepLinks: DeepLinkAdapter;
  storage: StorageAdapter;
  media: MediaPermissionAdapter;
  screenShare: ScreenShareAdapter;
}>;
