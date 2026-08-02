import { detectPlatform } from "./detect";
import { createDesktopPlatform } from "./desktop/createDesktopPlatform";
import { createWebPlatform } from "./web/createWebPlatform";
import type { PlatformAdapter } from "./types";

export type { PlatformAdapter, PlatformCapabilities, PlatformKind } from "./types";
export { detectPlatform, getPlatformCapabilities } from "./detect";

let cached: PlatformAdapter | null = null;

export function createPlatform(): PlatformAdapter {
  if (cached) return cached;
  cached = detectPlatform() === "desktop" ? createDesktopPlatform() : createWebPlatform();
  return cached;
}

export function getPlatform(): PlatformAdapter {
  return createPlatform();
}
