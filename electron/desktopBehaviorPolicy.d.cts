export type DesktopBehaviorInput = Readonly<{
  startupVisibility?: unknown;
  closeBehavior?: unknown;
  startupDestination?: unknown;
  lastSafeLocation?: unknown;
  launchMinimized?: unknown;
  closeToTray?: unknown;
}>;

export function normalizeDesktopBehavior(raw: unknown): Readonly<{
  startupVisibility: "normal" | "tray";
  closeBehavior: "tray" | "quit";
  startupDestination: "last" | "feed" | "messages" | "communities";
  lastSafeLocation: "feed" | "messages" | "communities" | null;
}>;

export function shouldStartHiddenInTray(input: Readonly<{
  trayReady: boolean;
  loginStartup: boolean;
  explicitLaunchIntent: boolean;
  settings: DesktopBehaviorInput;
}>): boolean;

export function shouldInterceptMainWindowClose(input: Readonly<{
  isQuitting: boolean;
  closeBehavior: "tray" | "quit";
  trayReady: boolean;
}>): boolean;
