import { useCallback, useEffect, useState } from "react";
import { rootDashboardAccessService, type RootDashboardAccessState } from "../services/rootDashboard/rootDashboardAccessService";

const initial: RootDashboardAccessState = {
  status: "loading",
  source: "none",
  allowed: false,
  isRootOwner: false,
  hasDashboardRead: false,
  checkedAt: null,
};

export function useRootDashboardAccess(enabled = true) {
  const [state, setState] = useState<RootDashboardAccessState>(initial);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(initial);
      return;
    }
    setState((current) => ({ ...current, status: "loading" }));
    setState(await rootDashboardAccessService.resolveAccess());
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setState(initial);
      return;
    }
    setState(initial);
    void rootDashboardAccessService.resolveAccess().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...state, refresh };
}
