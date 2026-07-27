import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  pathFromActiveView,
  parseWebPath,
  type ParsedWebPath,
  type WebActiveView,
  type WebPathParams,
} from "./routeMap";

const PENDING_AUTH_RETURN_KEY = "picom.web.pendingAuthReturnPath";

export type WebNavigationContextValue = Readonly<{
  currentPath: string;
  parsed: ParsedWebPath;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  syncFromApp: (activeView: WebActiveView | string, params?: WebPathParams) => void;
  pendingAuthReturnPath: string | null;
  setPendingAuthReturnPath: (path: string | null) => void;
  consumePendingAuthReturnPath: () => string | null;
}>;

const WebNavigationContext = createContext<WebNavigationContextValue | null>(null);

function readStoredReturnPath(): string | null {
  try {
    return sessionStorage.getItem(PENDING_AUTH_RETURN_KEY);
  } catch {
    return null;
  }
}

function writeStoredReturnPath(path: string | null): void {
  try {
    if (!path) sessionStorage.removeItem(PENDING_AUTH_RETURN_KEY);
    else sessionStorage.setItem(PENDING_AUTH_RETURN_KEY, path);
  } catch {
    /* private mode */
  }
}

export function WebNavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const [pendingAuthReturnPath, setPendingState] = useState<string | null>(() => readStoredReturnPath());

  const setPendingAuthReturnPath = useCallback((path: string | null) => {
    writeStoredReturnPath(path);
    setPendingState(path);
  }, []);

  const consumePendingAuthReturnPath = useCallback(() => {
    const value = readStoredReturnPath();
    writeStoredReturnPath(null);
    setPendingState(null);
    return value;
  }, []);

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      routerNavigate(to, { replace: options?.replace });
    },
    [routerNavigate],
  );

  const syncFromApp = useCallback(
    (activeView: WebActiveView | string, params: WebPathParams = {}) => {
      const next = pathFromActiveView(activeView, params);
      if (next === location.pathname) return;
      // Avoid fighting auth routes while signed out.
      const current = parseWebPath(location.pathname);
      if (current.isAuthRoute) return;
      routerNavigate(next, { replace: true });
    },
    [location.pathname, routerNavigate],
  );

  const value = useMemo<WebNavigationContextValue>(
    () => ({
      currentPath: location.pathname,
      parsed: parseWebPath(location.pathname),
      navigate,
      syncFromApp,
      pendingAuthReturnPath,
      setPendingAuthReturnPath,
      consumePendingAuthReturnPath,
    }),
    [
      location.pathname,
      navigate,
      syncFromApp,
      pendingAuthReturnPath,
      setPendingAuthReturnPath,
      consumePendingAuthReturnPath,
    ],
  );

  return (
    <WebNavigationContext.Provider value={value}>{children}</WebNavigationContext.Provider>
  );
}

export function useWebNavigation(): WebNavigationContextValue {
  const ctx = useContext(WebNavigationContext);
  if (!ctx) {
    throw new Error("useWebNavigation requires WebNavigationProvider (web runtime only).");
  }
  return ctx;
}

/** Safe for App.tsx: returns null on desktop where the provider is absent. */
export function useWebNavigationOptional(): WebNavigationContextValue | null {
  return useContext(WebNavigationContext);
}
