import { readFileSync } from "node:fs";

const files = {
  app: "src/App.tsx",
  component: "src/components/AppLockScreen.tsx",
  service: "src/services/appLockService.ts",
  settings: "src/components/SettingsModal.tsx",
  shortcuts: "src/services/shortcutService.ts",
  styles: "src/styles.css",
  docs: "docs/app-lock.md",
};

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

const app = read(files.app);
const component = read(files.component);
const service = read(files.service);
const settings = read(files.settings);
const shortcuts = read(files.shortcuts);
const styles = read(files.styles);
const docs = read(files.docs);

[
  "import { AppLockScreen } from \"./components/AppLockScreen\";",
  "const [isAppLocked, setIsAppLocked]",
  "const lockApp = useCallback",
  "Ctrl + Shift + L",
  "id: \"cmd-lock-app\"",
  "<AppLockScreen currentUser={displayedCurrentUser}",
].forEach((needle) => assertIncludes(app, needle, `App lock wiring ${needle}`));

[
  "export function AppLockScreen",
  "aria-modal=\"true\"",
  "Picom is locked",
  "Type anything to unlock locally",
  "onLogout",
].forEach((needle) => assertIncludes(component, needle, `lock screen component ${needle}`));

[
  "export interface AppLockSettings",
  "lockAfterInactivityEnabled",
  "inactivityMinutes",
  "appLockSettingsKey",
  "updateSettings(partial",
].forEach((needle) => assertIncludes(service, needle, `app lock service ${needle}`));

[
  "import { appLockService } from \"../services/appLockService\";",
  "const [appLockSettings, setAppLockSettings]",
  "Lock app after inactivity placeholder",
].forEach((needle) => assertIncludes(settings, needle, `settings app lock ${needle}`));

assertIncludes(shortcuts, "lockApp", "shortcut action");
assertIncludes(shortcuts, "Ctrl + Shift + L", "shortcut binding");
assertIncludes(styles, ".app-lock-backdrop", "lock backdrop styles");
assertIncludes(docs, "No password is stored locally.", "security documentation");

[app, component, service, settings].forEach((text) => {
  ["passwordHash", "access_token", "refresh_token", "authorization", "localStorage.setItem(\"password"].forEach((needle) => {
    assertNotIncludes(text, needle, "sensitive app lock storage");
  });
});

console.log("App lock quick lock smoke test passed.");
