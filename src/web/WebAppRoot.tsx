import { useEffect, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { App } from "../App";
import { accountCenterUrls } from "../config/accountCenterUrls";
import {
  consumeSessionContinue,
  generateSessionContinueNonce,
  isValidSessionContinueNonce,
} from "../services/auth/sessionContinueService";
import { authService, type AuthServiceSession } from "../services/authService";
import {
  appendAttributionToUrl,
  captureAttributionFromLocation,
} from "../services/marketing/attribution";
import { WebNavigationProvider, useWebNavigation } from "./WebNavigationContext";

function AuthLoadingGate({ label = "Loading Picom..." }: { label?: string }) {
  return (
    <main
      className="first-run-onboarding onboarding-loading"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
      aria-busy="true"
      aria-live="polite"
    >
      <strong>{label}</strong>
    </main>
  );
}

function RegisterRedirect() {
  useEffect(() => {
    const nonce = generateSessionContinueNonce();
    const attribution = captureAttributionFromLocation();
    window.location.replace(
      appendAttributionToUrl(accountCenterUrls.registerWithNonce(nonce, "web"), attribution),
    );
  }, []);
  return <AuthLoadingGate label="Opening account registration..." />;
}

function AuthHandoffPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nonce = params.get("nonce");
    if (!isValidSessionContinueNonce(nonce)) {
      setError("This sign-in link is invalid or expired.");
      return;
    }
    void consumeSessionContinue(nonce).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
      }
      // AuthRoute / session listener will navigate into the app once session exists.
    });
  }, [params]);

  if (error) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div role="alert">
          <strong>{error}</strong>
          <p>
            <a href="/login">Sign in</a>
          </p>
        </div>
      </main>
    );
  }

  return <AuthLoadingGate label="Signing you into Picom..." />;
}

function useWebAuthSession(): { ready: boolean; session: AuthServiceSession | null } {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthServiceSession | null>(null);

  useEffect(() => {
    let alive = true;
    void authService.getCurrentSession().then((result) => {
      if (!alive) return;
      if (result.ok) setSession(result.data);
      setReady(true);
    });
    const unsubscribe = authService.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { ready, session };
}

function ProtectedRoute() {
  const { ready, session } = useWebAuthSession();
  const location = useLocation();
  const { setPendingAuthReturnPath } = useWebNavigation();

  useEffect(() => {
    if (ready && !session) {
      const returnPath = `${location.pathname}${location.search}`;
      if (returnPath && returnPath !== "/login" && returnPath !== "/register") {
        setPendingAuthReturnPath(returnPath);
      }
    }
  }, [ready, session, location.pathname, location.search, setPendingAuthReturnPath]);

  if (!ready) {
    return <AuthLoadingGate label="Restoring your Picom session..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { ready, session } = useWebAuthSession();
  const { pendingAuthReturnPath, consumePendingAuthReturnPath } = useWebNavigation();
  const [postAuthTarget, setPostAuthTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !session || postAuthTarget) return;
    setPostAuthTarget(consumePendingAuthReturnPath() ?? pendingAuthReturnPath ?? "/feed");
  }, [ready, session, postAuthTarget, consumePendingAuthReturnPath, pendingAuthReturnPath]);

  if (!ready) {
    return <AuthLoadingGate label="Restoring your Picom session..." />;
  }

  if (session) {
    if (!postAuthTarget) return <AuthLoadingGate label="Opening Picom..." />;
    return <Navigate to={postAuthTarget} replace />;
  }

  return <>{children}</>;
}

function WebRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthRoute>
            <App />
          </AuthRoute>
        }
      />
      <Route path="/register" element={<RegisterRedirect />} />
      <Route
        path="/forgot-password"
        element={
          <AuthRoute>
            <App />
          </AuthRoute>
        }
      />
      <Route
        path="/reset-password"
        element={<App />}
      />
      <Route path="/auth/callback" element={<App />} />
      <Route
        path="/auth/handoff"
        element={
          <AuthRoute>
            <AuthHandoffPage />
          </AuthRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/feed" element={<App />} />
        <Route path="/messages" element={<App />} />
        <Route path="/messages/:conversationId" element={<App />} />
        <Route path="/communities" element={<App />} />
        <Route path="/communities/:communitySlug" element={<App />} />
        <Route path="/communities/:communitySlug/channels/:channelId" element={<App />} />
        <Route path="/notifications" element={<App />} />
        <Route path="/search" element={<App />} />
        <Route path="/profile/:username" element={<App />} />
        <Route path="/settings/*" element={<App />} />
        <Route path="/voice/:roomId" element={<App />} />
        <Route path="/friends" element={<App />} />
        <Route path="/live" element={<App />} />
        <Route path="/live-now/:liveSessionId" element={<App />} />
        <Route path="/go-live" element={<App />} />
        <Route path="/live/studio/:studioSessionId" element={<App />} />
        <Route path="/events" element={<App />} />
        <Route path="/events/create" element={<App />} />
        <Route path="/events/:eventId" element={<App />} />
        <Route path="/bookmarks" element={<App />} />
        <Route path="/saved" element={<App />} />
        <Route path="*" element={<App />} />
      </Route>
    </Routes>
  );
}

/**
 * Web SPA root: BrowserRouter + auth-aware routes around the existing App shell.
 * Desktop continues to boot via src/main.tsx and is unaffected.
 */
export function WebAppRoot() {
  return (
    <BrowserRouter>
      <WebNavigationProvider>
        <WebRoutes />
      </WebNavigationProvider>
    </BrowserRouter>
  );
}
