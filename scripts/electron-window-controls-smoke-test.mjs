import { readFileSync } from "node:fs";
import ts from "typescript";

const main = readFileSync("electron/main.cts", "utf8");
const preload = readFileSync("electron/preload.cts", "utf8");
const serviceSource = readFileSync("src/services/windowService.ts", "utf8");
const titlebar = readFileSync("src/components/WindowTitleBar.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

for (const marker of [
  "BrowserWindow.fromWebContents(event.sender)",
  "window.isDestroyed()",
  'action === "minimize"',
  'action === "maximize"',
  "window.unmaximize()",
  "window.maximize()",
  'action === "close"',
  "window.close()",
  "sendWindowMaximizeState(window)",
  'error: "WINDOW_ACTION_FAILED"',
]) {
  if (!main.includes(marker)) throw new Error(`Main window-control contract missing: ${marker}`);
}

for (const marker of ["windowControl:", "isWindowMaximized:", "onWindowMaximizeStateChanged:", "invokeWhitelisted(IPC_CHANNELS.windowControl"]) {
  if (!preload.includes(marker)) throw new Error(`Preload window-control contract missing: ${marker}`);
}

for (const marker of ["data-window-state", "aria-pressed={isMaximized}", "runWindowAction", "titlebar-control-status"]) {
  if (!titlebar.includes(marker)) throw new Error(`Titlebar state contract missing: ${marker}`);
}

for (const marker of ["-webkit-app-region:drag", "-webkit-app-region:no-drag", ".window-control:focus-visible", ".window-control:disabled"]) {
  if (!styles.includes(marker)) throw new Error(`Titlebar CSS contract missing: ${marker}`);
}

const compiledService = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const calls = [];
let maximizeListener;
globalThis.window = {
  picomDesktop: {
    windowControl: async (action) => {
      calls.push(action);
      return { ok: true, native: true, action, maximized: action === "maximize" };
    },
    isWindowMaximized: async () => true,
    onWindowMaximizeStateChanged: (callback) => {
      maximizeListener = callback;
      return () => { maximizeListener = undefined; };
    },
  },
};

const { windowService } = await import(`data:text/javascript;base64,${Buffer.from(compiledService).toString("base64")}`);
for (const action of ["minimize", "maximize", "close"]) {
  const result = await windowService.run(action);
  if (!result.ok || !result.native || result.action !== action) throw new Error(`Renderer service rejected valid action: ${action}`);
}
if (calls.join(",") !== "minimize,maximize,close") throw new Error("Renderer service did not forward all window actions exactly once");
if (!(await windowService.isMaximized())) throw new Error("Renderer service did not return maximized state");

let forwardedState = false;
const unsubscribe = windowService.onMaximizeStateChanged((value) => { forwardedState = value; });
maximizeListener?.(true);
if (!forwardedState) throw new Error("Renderer maximize event was not forwarded");
unsubscribe();

globalThis.window = {};
const unavailable = await windowService.run("minimize");
if (unavailable.ok || unavailable.error !== "WINDOW_CONTROL_UNAVAILABLE") throw new Error("Missing bridge must fail closed instead of reporting fake success");

console.log("Electron window controls contract test passed.");
