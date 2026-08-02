import type { PlatformResult } from "../types";

export function desktopOnly<T = true>(feature: string): PlatformResult<T> {
  return {
    ok: false,
    code: "DESKTOP_ONLY",
    message: `${feature} is only available in the Picom desktop app.`,
    desktopOnly: true,
  };
}

export function unavailable<T = true>(code: string, message: string): PlatformResult<T> {
  return { ok: false, code, message };
}
