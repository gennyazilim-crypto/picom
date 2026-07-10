import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const main = read("electron/main.cts");
const config = read("electron/appConfig.cts");
const shell = read("src/components/DesktopAppShell.tsx");
const bounds = read("src/utils/desktopDisplayBounds.ts");
const contextMenu = read("src/components/DesktopContextMenu.tsx");
const profilePopover = read("src/components/UserProfilePopover.tsx");
const styles = read("src/styles.css");
const docs = read("docs/desktop-display-qa.md");

for (const marker of ["defaultWidth: 1440", "defaultHeight: 900", "minWidth: 1100", "minHeight: 700"])
  assert(config.includes(marker), `Electron window config is missing ${marker}`);

for (const marker of ["screen.getAllDisplays()", "display.workArea", "minimumVisibleSize = 120", "isWindowStateVisible", 'window.on("maximize"', 'window.on("unmaximize"'])
  assert(main.includes(marker), `Electron display/window-state path is missing ${marker}`);

for (const marker of ["is-maximized", 'data-window-state={isMaximized ? "maximized" : "normal"}', "onMaximizeStateChanged"])
  assert(shell.includes(marker), `DesktopAppShell maximize contract is missing ${marker}`);

for (const marker of ["Math.min(Math.max", "viewportWidth - width - margin", "viewportHeight - height - margin", "Number.isFinite"])
  assert(bounds.includes(marker), `Overlay bounds helper is missing ${marker}`);
assert(contextMenu.includes("clampOverlayPosition"), "Desktop context menus must be clamped to all viewport edges");
assert(profilePopover.includes("clampOverlayPosition"), "Profile popovers must be clamped to all viewport edges");

for (const marker of ["min-width:1100px", ".picom-root.is-maximized", "max-width:calc(100vw - 96px)", "max-height:calc(100vh"])
  assert(styles.includes(marker), `Desktop layout/modal bounds CSS is missing ${marker}`);

for (const marker of ["100%", "125%", "150%", "1920x1080", "2560x1440", "ultrawide", "secondary monitor", "manual hardware status: pending", "No mobile UI"])
  assert(docs.includes(marker), `Desktop display QA documentation is missing ${marker}`);

console.log("Desktop display scaling structural QA passed; physical multi-monitor/DPI evidence remains manual.");
