import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const servicePath = path.join(root, "src/services/navigation/authenticatedRouteService.ts");
const appPath = path.join(root, "src/App.tsx");
const source = await readFile(servicePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routes = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.equal(routes.AUTHENTICATED_DEFAULT_VIEW, "feed");
for (const reason of ["login", "registration", "onboarding_complete", "session_restore", "relaunch"]) {
  assert.deepEqual(routes.createAuthenticatedLandingIntent(reason), { route: "feed", source: reason });
}

const router = routes.createAuthenticatedEntryRouter();
assert.equal(router.onSessionChanged(null), null);
assert.equal(router.onSessionChanged("user-1", "login")?.route, "feed");
assert.equal(router.onSessionChanged("user-1"), null, "same-session navigation must be preserved");
assert.equal(router.onSessionChanged("user-2")?.route, "feed");
router.reset();
assert.equal(router.onSessionChanged("user-1", "relaunch")?.route, "feed");

assert.equal(routes.normalizeAuthenticatedRouteKey("home"), "feed");
assert.equal(routes.normalizeAuthenticatedRouteKey("mentionFeed"), "feed");
assert.equal(routes.normalizeAuthenticatedRouteKey("dm"), "directMessages");
assert.equal(routes.normalizeAuthenticatedRouteKey("unknown-route"), null);
assert.equal(routes.resolveAuthenticatedDeepLink("profile", { userId: "user-2" }, false), null);
assert.equal(routes.resolveAuthenticatedDeepLink("profile", {}, true), null);
assert.equal(
  routes.resolveAuthenticatedDeepLink("profile", { userId: "user-2" }, true)?.route,
  "profile",
);
assert.equal(
  routes.resolveAuthenticatedDeepLink("voice", { channelId: "channel-1" }, true)?.route,
  "voice",
);

const app = await readFile(appPath, "utf8");
assert.match(app, /useState<ActiveView>\(\(\) =>\s*toLegacyActiveView\(AUTHENTICATED_DEFAULT_VIEW\)/);
assert.match(app, /authenticatedEntryRouter\.onSessionChanged\(authSession\?\.user\?\.id \?\? null\)/);
assert.match(app, /createAuthenticatedLandingIntent\("onboarding_complete"\)/);

console.log("Authenticated route and Feed landing smoke PASS");
