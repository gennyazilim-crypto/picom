import type { CompanionPreferences } from "./companionTypes";

export const DEFAULT_COMPANION_PREFERENCES: CompanionPreferences = Object.freeze({
  version: 1,
  startupMode: "main",
  alwaysOnTop: false,
  compactDensity: false,
  closeToTray: true,
  showNotifications: true,
  theme: "system",
  windowOpacity: 1,
  dockEdge: "right",
  smartCollapse: true,
  dockAutoHide: false,
  gamingAutoDetect: true,
});

function mergePreferences(remote: Partial<CompanionPreferences> | null | undefined): CompanionPreferences {
  if (!remote) return DEFAULT_COMPANION_PREFERENCES;
  return Object.freeze({
    ...DEFAULT_COMPANION_PREFERENCES,
    ...Object.fromEntries(Object.entries(remote).filter(([, value]) => value !== undefined)),
  }) as CompanionPreferences;
}

export async function getCompanionPreferences(): Promise<CompanionPreferences> {
  return mergePreferences(await window.picomDesktop?.companion?.getPreferences());
}

export async function updateCompanionPreferences(patch: Partial<Omit<CompanionPreferences, "version">>): Promise<CompanionPreferences> {
  const remote = await window.picomDesktop?.companion?.setPreferences(patch);
  if (remote && typeof remote === "object" && "startupMode" in remote) {
    return mergePreferences(remote as Partial<CompanionPreferences>);
  }
  // Browser preview / IPC unavailable: apply patch locally so the UI still updates.
  const current = await getCompanionPreferences();
  return mergePreferences({ ...current, ...patch });
}
