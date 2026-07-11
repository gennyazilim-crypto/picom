import { readFileSync } from "node:fs";

const read = (filePath) => readFileSync(filePath, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = read("electron/main.cts");
const config = read("electron/appConfig.cts");
const shell = read("src/components/DesktopAppShell.tsx");
const titlebar = read("src/components/WindowTitleBar.tsx");
const windowService = read("src/services/windowService.ts");
const styles = read("src/styles.css");
const qaDocument = read("docs/electron-window-state-qa.md");
const normalizedQaDocument = qaDocument.toLowerCase();
const packageJson = JSON.parse(read("package.json"));

for (const marker of ["defaultWidth: 1440", "defaultHeight: 900", "minWidth: 1100", "minHeight: 700", "backgroundColor"] ) {
  assert(config.includes(marker), `Electron app config is missing ${marker}`);
}

for (const marker of [
  "frame: false",
  "transparent: false",
  "autoHideMenuBar: true",
  "Menu.setApplicationMenu(null)",
  "setMenuBarVisibility(false)",
  "screen.getAllDisplays()",
  "display.workArea",
  "minimumVisibleSize = 120",
  "isWindowStateVisible",
  'window.on("maximize"',
  'window.on("unmaximize"',
]) {
  assert(main.includes(marker), `Electron main window-state contract is missing ${marker}`);
}

for (const marker of [
  "is-maximized",
  'data-window-state={isMaximized ? "maximized" : "normal"}',
  "windowService.isMaximized()",
  "windowService.onMaximizeStateChanged",
]) {
  assert(shell.includes(marker), `Desktop shell state synchronization is missing ${marker}`);
}

for (const marker of ["data-window-state", "aria-pressed", "Restore window", "Maximize window", "pendingAction"]) {
  assert(titlebar.includes(marker), `Custom titlebar state contract is missing ${marker}`);
}

for (const marker of ["isMaximized", "onMaximizeStateChanged", "WINDOW_CONTROL_UNAVAILABLE", "WINDOW_CONTROL_FAILED"]) {
  assert(windowService.includes(marker), `Window service fail-safe contract is missing ${marker}`);
}

assert(/html\s*,\s*body\s*,\s*#root\s*\{[^}]*overflow\s*:\s*hidden/isu.test(styles), "Root surfaces must clip BrowserWindow overflow");
assert(styles.includes("var(--window-backdrop)"), "Window backdrop token is missing");
assert(styles.includes("var(--shadow-app)"), "Normal floating frame shadow token is missing");
assert(/\.picom-root\.is-maximized\s*\{[^}]*padding\s*:\s*0(?:px)?/isu.test(styles), "Maximized root must remove outer padding");
assert(/\.picom-root\.is-maximized\s+\.desktop-app-shell\s*\{[^}]*border-radius\s*:\s*0(?:px)?/isu.test(styles), "Maximized frame must remove corner radius");
assert(/\.picom-root\.is-maximized\s+\.desktop-app-shell\s*\{[^}]*box-shadow\s*:\s*none/isu.test(styles), "Maximized frame must remove the floating shadow");
assert(styles.includes("-webkit-app-region:drag"), "Custom titlebar drag region is missing");
assert(styles.includes("-webkit-app-region:no-drag"), "Interactive titlebar no-drag region is missing");
assert(/:focus-visible/iu.test(styles), "Keyboard-only focus styling is missing");

for (const marker of [
  "100%",
  "125%",
  "150%",
  "single-monitor",
  "multi-monitor",
  "off-screen recovery",
  "double-click",
  "fullscreen-adjacent",
  "win-unpacked",
  "blocked",
]) {
  assert(normalizedQaDocument.includes(marker), `Window-state QA documentation is missing ${marker}`);
}

assert(
  packageJson.scripts?.["electron:window-state:qa"] === "node scripts/electron-window-state-frame-qa.mjs",
  "electron:window-state:qa package script is missing",
);

console.log("Electron window state and frame structural QA passed.");
console.log("Physical mixed-DPI and multi-monitor checks remain explicitly blocked until matching hardware is available.");
