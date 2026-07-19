import { profileMediaResolver } from "./profileMediaResolver";
import type { ProfileMediaKind } from "./profileMediaTypes";

export const profileMediaInvalidationService = {
  invalidate(userId: string, kind?: ProfileMediaKind, version?: number): void {
    profileMediaResolver.invalidate(userId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("picom:profile-media-updated", {
        detail: { userId, kind: kind ?? null, version: version ?? null },
      }));
    }
  },
};
