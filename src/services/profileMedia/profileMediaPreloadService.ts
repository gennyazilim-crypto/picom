import { profileMediaResolver } from "./profileMediaResolver";

export const profileMediaPreloadService = {
  async preload(userIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    await Promise.allSettled(uniqueIds.map((userId) => profileMediaResolver.resolve(userId)));
  },
};
