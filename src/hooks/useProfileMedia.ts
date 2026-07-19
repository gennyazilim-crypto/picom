import { useCallback, useEffect, useSyncExternalStore } from "react";
import { profileMediaResolver } from "../services/profileMedia/profileMediaResolver";
import { profileMediaStore } from "../services/profileMedia/profileMediaStore";

export function useProfileMedia(userId?: string | null) {
  const subscribe = useCallback(
    (listener: () => void) => userId ? profileMediaStore.subscribe(userId, listener) : () => undefined,
    [userId],
  );
  const getSnapshot = useCallback(() => profileMediaStore.getSnapshot(userId), [userId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (userId) void profileMediaResolver.resolve(userId);
  }, [userId]);

  return snapshot;
}
