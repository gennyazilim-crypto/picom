/**
 * TASK 13B start-in-tray retest using completed isolated profile + --picom-login-startup.
 * Visibility is observed via Windows MainWindowHandle, not document.hidden.
 */
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR;
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9337);

function stopPackaged() {
  try { execFileSync("taskkill", ["/IM", "Picom.exe", "/F"], { stdio: "ignore" }); } catch { /* none */ }
}
function visibleWindows() {
  try {
    return Number(execFileSync("powershell", ["-NoProfile", "-Command",
      "(Get-Process Picom -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Measure-Object).Count"],
      { encoding: "utf8" }).trim());
  } catch {
    return -1;
  }
}
function processCount() {
  try {
    return Number(execFileSync("powershell", ["-NoProfile", "-Command",
      "(Get-Process Picom -ErrorAction SilentlyContinue | Measure-Object).Count"],
      { encoding: "utf8" }).trim());
  } catch {
    return -1;
  }
}

async function waitForCdp(timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch { /* launching */ }
    await delay(400);
  }
  throw new Error("CDP target not available");
}

async function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => { socket.close(); reject(new Error("timeout")); }, 15000);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result?.result?.value);
    });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("socket")); });
  });
}

stopPackaged();
await delay(1000);
spawn(EXE, [`--remote-debugging-port=${PORT}`, "--picom-login-startup"], {
  env: { ...process.env, PICOM_USER_DATA_DIR: PROFILE },
  detached: true,
  stdio: "ignore",
}).unref();
const page = await waitForCdp();
await delay(2000);
const hiddenObservation = {
  processCount: processCount(),
  visibleMainWindows: visibleWindows(),
};
const ws = page.webSocketDebuggerUrl;
const snap = await evaluate(ws, `({ hidden: document.hidden, hasLogin: Boolean(document.querySelector(".auth-desktop-frame")), hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")) })`);
await evaluate(ws, `window.picomDesktop?.tray?.showWindow ? window.picomDesktop.tray.showWindow() : { ok: false }`);
await delay(800);
const afterShow = {
  processCount: processCount(),
  visibleMainWindows: visibleWindows(),
  snap: await evaluate(ws, `({ hidden: document.hidden, hasLogin: Boolean(document.querySelector(".auth-desktop-frame")), hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")) })`),
};
const result = hiddenObservation.visibleMainWindows === 0 && hiddenObservation.processCount > 0 && afterShow.visibleMainWindows >= 1
  ? "PACKAGED_PASS"
  : "FAIL";
const payload = { result, hiddenObservation, snap, afterShow };
writeFileSync(join(EVIDENCE, "start-in-tray-retest.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload));
await evaluate(ws, `window.picomDesktop?.tray?.quit ? window.picomDesktop.tray.quit() : null`).catch(() => {});
await delay(800);
stopPackaged();
if (result !== "PACKAGED_PASS") process.exit(1);
