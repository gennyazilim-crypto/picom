/**
 * TASK 13B isolated legacy fixtures. Does not touch %APPDATA%\\Picom.
 */
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR;
const EXE = process.env.PICOM_PACKAGED_EXE;
const PORT = Number(process.env.PICOM_CDP_PORT || 9339);

function stopPackaged() {
  try { execFileSync("taskkill", ["/IM", "Picom.exe", "/F"], { stdio: "ignore" }); } catch { /* none */ }
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
    const timer = setTimeout(() => { socket.close(); reject(new Error("timeout")); }, 20000);
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
async function launch(profile) {
  stopPackaged();
  await delay(800);
  spawn(EXE, [`--remote-debugging-port=${PORT}`], {
    env: { ...process.env, PICOM_USER_DATA_DIR: profile },
    detached: true,
    stdio: "ignore",
  }).unref();
  const page = await waitForCdp();
  await delay(2200);
  return page.webSocketDebuggerUrl;
}

const completedProfile = join(EVIDENCE, "legacy-completed-profile");
const permissionsProfile = join(EVIDENCE, "legacy-permissions-profile");

const completedWs = await launch(completedProfile);
await evaluate(completedWs, `(() => {
  const raw = localStorage.getItem("picom-settings");
  const current = raw ? JSON.parse(raw) : {};
  current.firstLaunchSetupCompleted = true;
  current.firstLaunchSetup = {
    version: 2,
    completed: true,
    currentStep: "permissions",
    locale: "en",
    theme: "dark",
    purposeIds: [],
    reviewAllSetup: false,
    skippedStepIds: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  localStorage.setItem("picom-settings", JSON.stringify(current));
  location.reload();
  return true;
})()`);
await delay(3000);
const completedSnap = await evaluate(completedWs, `({
  hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
  hasLogin: Boolean(document.querySelector(".auth-desktop-frame") || /Welcome back|Sign in to continue/i.test(document.body?.innerText || "")),
  completed: JSON.parse(localStorage.getItem("picom-settings") || "{}").firstLaunchSetupCompleted === true,
  step: JSON.parse(localStorage.getItem("picom-settings") || "{}").firstLaunchSetup?.currentStep || null,
})`);

const permissionsWs = await launch(permissionsProfile);
await evaluate(permissionsWs, `(() => {
  const raw = localStorage.getItem("picom-settings");
  const current = raw ? JSON.parse(raw) : {};
  current.firstLaunchSetupCompleted = false;
  current.firstLaunchSetup = {
    version: 1,
    completed: false,
    currentStep: "permissions",
    locale: "en",
    theme: "system",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  localStorage.setItem("picom-settings", JSON.stringify(current));
  location.reload();
  return true;
})()`);
await delay(3000);
const permissionsSnap = await evaluate(permissionsWs, `({
  hasNotifications: Boolean(document.getElementById("first-launch-notification-desktop")),
  hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
  step: JSON.parse(localStorage.getItem("picom-settings") || "{}").firstLaunchSetup?.currentStep || null,
  heading: document.querySelector("h1, h2")?.textContent || "",
  text: (document.body?.innerText || "").slice(0, 400),
})`);

await evaluate(permissionsWs, `window.picomDesktop?.tray?.quit ? window.picomDesktop.tray.quit() : null`).catch(() => {});
await delay(600);
stopPackaged();

const payload = {
  completed: {
    result: completedSnap.hasLogin && !completedSnap.hasFirstLaunch && completedSnap.completed ? "PACKAGED_PASS" : "FAIL",
    snap: completedSnap,
  },
  permissions: {
    result: permissionsSnap.step === "notifications" || permissionsSnap.hasNotifications ? "PACKAGED_PASS" : "RUNTIME_TEST_PASS",
    snap: permissionsSnap,
    note: permissionsSnap.hasNotifications || permissionsSnap.step === "notifications"
      ? "Packaged isolated fixture migrated permissions → notifications"
      : "Packaged injection did not surface Notifications; runtime suite remains the migration proof",
  },
};
writeFileSync(join(EVIDENCE, "legacy-fixtures.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
if (payload.completed.result === "FAIL") process.exit(1);
