import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = resolve(root, "src/App.tsx");
const boundaryPath = resolve(root, "src/components/DesktopStartupErrorBoundary.tsx");

const appSource = readFileSync(appPath, "utf8");
const boundarySource = readFileSync(boundaryPath, "utf8");

const appStart = appSource.indexOf("export function App()");
if (appStart === -1) {
  throw new Error("App component entry point was not found.");
}

const appBody = appSource.slice(appStart);
const firstLaunchGuardIndex = appBody.indexOf("if (!safeMode.active && !firstLaunchSetupCompleted)");
const authReadyGuardIndex = appBody.indexOf("if (!authReady)");
const protectedSessionGuardIndex = appBody.indexOf("if (passwordRecoveryMode || !authSession)");
if (firstLaunchGuardIndex === -1 || authReadyGuardIndex === -1 || protectedSessionGuardIndex === -1) {
  throw new Error("Protected auth readiness/session guards were not found in App.");
}
if (authReadyGuardIndex <= firstLaunchGuardIndex) {
  throw new Error("Auth readiness guard must run after first-launch guard.");
}
if (protectedSessionGuardIndex <= authReadyGuardIndex) {
  throw new Error("Protected session guard must run after auth readiness is resolved.");
}
const authGuardIndex = firstLaunchGuardIndex;

const requiredHooksBeforeAuthGuard = [
  "useState",
  "useLocalMessageState",
  "useMvpAppState",
  "useOverlayState",
  "useMemberSidebarState",
  "useProtectedDesktopSession",
  "useSupabaseMessageRealtime",
  "useSupabaseTypingBroadcast",
  "useSupabasePresenceChannel",
  "useEffect",
  "useMemo",
  "useCallback"
];

for (const hookName of requiredHooksBeforeAuthGuard) {
  const hookIndex = appBody.indexOf(`${hookName}(`);
  if (hookIndex === -1) {
    throw new Error(`Expected App hook is missing: ${hookName}`);
  }

  if (hookIndex > authGuardIndex) {
    throw new Error(`Hook appears after the auth early-return guard: ${hookName}`);
  }
}

const afterAuthGuard = appBody.slice(authGuardIndex);
const hookAfterGuard = afterAuthGuard.match(/\buse[A-Z][A-Za-z0-9_]*\s*\(/);
if (hookAfterGuard) {
  throw new Error(`Hook call appears after auth early-return guard: ${hookAfterGuard[0]}`);
}

const boundaryChecks = [
  "extends Component",
  "componentDidCatch",
  "loggingService.captureException",
  "crashRecoveryService.recordCrash",
  "crashRecoveryService.getDiagnosticsText()"
];

for (const term of boundaryChecks) {
  if (!boundarySource.includes(term)) {
    throw new Error(`Startup error boundary is missing crash diagnostic behavior: ${term}`);
  }
}

console.log("OK App auth guard hook order");
console.log("OK startup error boundary crash diagnostics");
console.log("OK React hook order smoke test completed");
