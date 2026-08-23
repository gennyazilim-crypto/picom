/**
 * Device-only desktop behavior preferences.
 *
 * The main-process device settings file is the durable source of truth in
 * Electron. This service deliberately stores only safe, high-level locations:
 * it never records a conversation, channel, profile, token, or account id.
 */

export const DESKTOP_STARTUP_VISIBILITIES = ["normal", "tray"] as const;
export type DesktopStartupVisibility = (typeof DESKTOP_STARTUP_VISIBILITIES)[number];

export const DESKTOP_CLOSE_BEHAVIORS = ["tray", "quit"] as const;
export type DesktopCloseBehavior = (typeof DESKTOP_CLOSE_BEHAVIORS)[number];

/** Maps to existing App ActiveView values, rather than creating a new route type. */
export const DESKTOP_STARTUP_DESTINATIONS = ["last", "feed", "messages", "communities"] as const;
export type DesktopStartupDestination = (typeof DESKTOP_STARTUP_DESTINATIONS)[number];
export type DesktopSafeLocation = Exclude<DesktopStartupDestination, "last">;

export type DesktopStartupCapability = "supported" | "dev-unavailable" | "unsupported" | "unavailable";

export type DesktopBehaviorPreferences = Readonly<{
  launchAtStartup: boolean;
  startupVisibility: DesktopStartupVisibility;
  closeBehavior: DesktopCloseBehavior;
  startupDestination: DesktopStartupDestination;
  lastSafeLocation: DesktopSafeLocation | null;
  startupCapability: DesktopStartupCapability;
  trayAvailable: boolean;
}>;

export type DesktopBehaviorPatch = Partial<Pick<
  DesktopBehaviorPreferences,
  "startupVisibility" | "closeBehavior" | "startupDestination" | "lastSafeLocation"
>>;

export type DesktopStartupRouteInput = Readonly<{
  firstLaunchRequired: boolean;
  authenticationRequired: boolean;
  accountOnboardingRequired: boolean;
  explicitDestination?: DesktopSafeLocation | null;
  activeDestination?: DesktopSafeLocation | null;
  startupDestination: DesktopStartupDestination;
  lastSafeLocation?: DesktopSafeLocation | null;
  defaultDestination?: DesktopSafeLocation;
}>;

export function isDesktopStartupVisibility(value: unknown): value is DesktopStartupVisibility {
  return typeof value === "string" && (DESKTOP_STARTUP_VISIBILITIES as readonly string[]).includes(value);
}

export function isDesktopCloseBehavior(value: unknown): value is DesktopCloseBehavior {
  return typeof value === "string" && (DESKTOP_CLOSE_BEHAVIORS as readonly string[]).includes(value);
}

export function isDesktopStartupDestination(value: unknown): value is DesktopStartupDestination {
  return typeof value === "string" && (DESKTOP_STARTUP_DESTINATIONS as readonly string[]).includes(value);
}

export function isDesktopSafeLocation(value: unknown): value is DesktopSafeLocation {
  return value === "feed" || value === "messages" || value === "communities";
}

export function normalizeDesktopBehaviorPreferences(raw: unknown): Omit<DesktopBehaviorPreferences, "launchAtStartup" | "startupCapability" | "trayAvailable"> {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const startupVisibility = isDesktopStartupVisibility(record.startupVisibility)
    ? record.startupVisibility
    : record.launchMinimized === true ? "tray" : "normal";
  const closeBehavior = isDesktopCloseBehavior(record.closeBehavior)
    ? record.closeBehavior
    : record.closeToTray === false ? "quit" : "tray";

  return {
    startupVisibility,
    closeBehavior,
    startupDestination: isDesktopStartupDestination(record.startupDestination) ? record.startupDestination : "last",
    lastSafeLocation: isDesktopSafeLocation(record.lastSafeLocation) ? record.lastSafeLocation : null,
  };
}

/**
 * Central precedence policy. Gates intentionally win over every passive
 * preference; a native deep link/notification intent wins over startup choice.
 */
export function resolveDesktopStartupDestination(input: DesktopStartupRouteInput): DesktopSafeLocation | null {
  if (input.firstLaunchRequired || input.authenticationRequired || input.accountOnboardingRequired) return null;
  if (isDesktopSafeLocation(input.explicitDestination)) return input.explicitDestination;
  if (isDesktopSafeLocation(input.activeDestination)) return input.activeDestination;
  if (input.startupDestination !== "last") return input.startupDestination;
  if (isDesktopSafeLocation(input.lastSafeLocation)) return input.lastSafeLocation;
  return input.defaultDestination ?? "feed";
}

/**
 * The renderer initially mounts the default view. Waiting until passive
 * startup routing has resolved prevents that temporary view from replacing a
 * durable "last location" preference.
 */
export function canPersistDesktopSafeLocation(input: Readonly<{
  userId: string | null | undefined;
  startupRouteAppliedForUserId: string | null;
  destination: DesktopSafeLocation | null;
}>): input is Readonly<{ userId: string; startupRouteAppliedForUserId: string; destination: DesktopSafeLocation }> {
  return Boolean(input.userId && input.destination && input.startupRouteAppliedForUserId === input.userId);
}

function defaultState(): DesktopBehaviorPreferences {
  return {
    launchAtStartup: false,
    startupVisibility: "normal",
    closeBehavior: "quit",
    startupDestination: "last",
    lastSafeLocation: null,
    startupCapability: typeof window !== "undefined" && window.picomDesktop?.startup
      ? "unavailable"
      : "unsupported",
    trayAvailable: false,
  };
}

let cachedState: DesktopBehaviorPreferences = defaultState();
const listeners = new Set<(settings: DesktopBehaviorPreferences) => void>();

function emit(next: DesktopBehaviorPreferences): DesktopBehaviorPreferences {
  cachedState = next;
  listeners.forEach((listener) => listener(next));
  return next;
}

function bridgeUnavailableState(current: DesktopBehaviorPreferences): DesktopBehaviorPreferences {
  return {
    ...current,
    startupCapability: typeof window !== "undefined" && window.picomDesktop?.startup ? "unavailable" : "unsupported",
    trayAvailable: Boolean(window.picomDesktop?.tray),
  };
}

function toState(raw: unknown, launchAtStartup: boolean, startupCapability: DesktopStartupCapability, trayAvailable: boolean): DesktopBehaviorPreferences {
  return {
    ...normalizeDesktopBehaviorPreferences(raw),
    launchAtStartup,
    startupCapability,
    trayAvailable,
  };
}

async function readNativeState(): Promise<DesktopBehaviorPreferences> {
  if (typeof window === "undefined") return emit(defaultState());
  const desktop = window.picomDesktop;
  const settingsResult = await desktop?.settings?.get?.().catch(() => null);
  const startupResult = await desktop?.startup?.getState?.().catch(() => null);

  if (!settingsResult || !settingsResult.ok) {
    return emit(bridgeUnavailableState(cachedState));
  }

  const startupCapability: DesktopStartupCapability = !startupResult
    ? "unavailable"
    : !startupResult.ok
      ? "unavailable"
      : startupResult.supported
        ? "supported"
        : desktop?.getRuntimeInfo?.().platform === "linux"
          ? "unsupported"
          : "dev-unavailable";
  const nativeTray = desktop?.tray;
  const trayResult = nativeTray?.setCloseToTray
    ? await nativeTray.setCloseToTray(settingsResult.settings.closeBehavior !== "quit").catch(() => null)
    : null;
  const trayAvailable = trayResult?.ok === true && trayResult.supported === true;
  return emit(toState(
    settingsResult.settings,
    startupResult?.ok === true && startupResult.supported === true ? startupResult.enabled : false,
    startupCapability,
    trayAvailable,
  ));
}

function nativePatch(patch: DesktopBehaviorPatch): Record<string, unknown> {
  const normalized = normalizeDesktopBehaviorPreferences({ ...cachedState, ...patch });
  return {
    startupVisibility: normalized.startupVisibility,
    closeBehavior: normalized.closeBehavior,
    startupDestination: normalized.startupDestination,
    lastSafeLocation: normalized.lastSafeLocation,
    // Legacy aliases keep existing native consumers and pre-Task 08 settings compatible.
    launchMinimized: normalized.startupVisibility === "tray",
    closeToTray: normalized.closeBehavior === "tray",
  };
}

export const desktopBehaviorService = {
  getState(): DesktopBehaviorPreferences {
    return cachedState;
  },

  subscribe(listener: (settings: DesktopBehaviorPreferences) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  refresh(): Promise<DesktopBehaviorPreferences> {
    return readNativeState();
  },

  async updatePreferences(patch: DesktopBehaviorPatch): Promise<DesktopBehaviorPreferences> {
    if (typeof window === "undefined" || !window.picomDesktop?.settings?.set) {
      return emit(bridgeUnavailableState(cachedState));
    }
    const result = await window.picomDesktop.settings.set(nativePatch(patch)).catch(() => null);
    if (!result || !result.ok) return emit(bridgeUnavailableState(cachedState));

    const requested = normalizeDesktopBehaviorPreferences(result.settings);
    let closeBehavior = requested.closeBehavior;
    let trayAvailable = false;
    if (window.picomDesktop.tray?.setCloseToTray) {
      const trayResult = await window.picomDesktop.tray.setCloseToTray(closeBehavior === "tray").catch(() => null);
      trayAvailable = trayResult?.ok === true && trayResult.supported === true;
      // Never preserve a path that could hide a window without a working tray.
      if (closeBehavior === "tray" && !trayAvailable) {
        closeBehavior = "quit";
        const fallback = await window.picomDesktop.settings.set({ closeBehavior: "quit", closeToTray: false }).catch(() => null);
        if (fallback?.ok) return emit({
          ...toState(fallback.settings, cachedState.launchAtStartup, cachedState.startupCapability, false),
          closeBehavior: "quit",
        });
      }
    }
    return emit({
      ...toState(result.settings, cachedState.launchAtStartup, cachedState.startupCapability, trayAvailable),
      closeBehavior,
    });
  },

  async setLaunchAtStartup(enabled: boolean): Promise<DesktopBehaviorPreferences> {
    if (typeof window === "undefined" || !window.picomDesktop?.startup?.setEnabled) {
      return emit(bridgeUnavailableState(cachedState));
    }
    const result = await window.picomDesktop.startup.setEnabled(enabled).catch(() => null);
    if (!result || !result.ok) return emit({ ...cachedState, launchAtStartup: false, startupCapability: "unavailable" });
    return emit({ ...cachedState, launchAtStartup: result.enabled, startupCapability: "supported" });
  },

  async rememberSafeLocation(destination: unknown): Promise<DesktopBehaviorPreferences> {
    if (!isDesktopSafeLocation(destination)) return cachedState;
    return this.updatePreferences({ lastSafeLocation: destination });
  },
};
