import type { PlatformResult } from "../types";

export function unavailable<T = true>(message: string, code = "UNAVAILABLE"): PlatformResult<T> {
  return { ok: false, code, message };
}
