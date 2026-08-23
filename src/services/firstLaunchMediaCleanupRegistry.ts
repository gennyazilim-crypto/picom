const extraCleanups = new Set<() => void>();

export function registerFirstLaunchMediaCleanup(cleanup: () => void): () => void {
  extraCleanups.add(cleanup);
  return () => {
    extraCleanups.delete(cleanup);
  };
}

export function runRegisteredFirstLaunchMediaCleanups(): void {
  for (const cleanup of extraCleanups) {
    try {
      cleanup();
    } catch {
      // Cleanup must not block completion; remaining releases still run.
    }
  }
}
