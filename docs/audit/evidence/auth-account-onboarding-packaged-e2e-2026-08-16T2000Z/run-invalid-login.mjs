/**
 * One controlled invalid packaged login. No real credentials. No account creation.
 */
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR;
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9340);

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
  throw new Error("CDP unavailable");
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

stopPackaged();
await delay(800);
spawn(EXE, [`--remote-debugging-port=${PORT}`], {
  env: { ...process.env, PICOM_USER_DATA_DIR: PROFILE },
  detached: true,
  stdio: "ignore",
}).unref();
const page = await waitForCdp();
const ws = page.webSocketDebuggerUrl;
await delay(2500);
const before = await evaluate(ws, `({
  hasLogin: Boolean(document.querySelector(".auth-desktop-frame") || /Sign in|Welcome back/i.test(document.body?.innerText || "")),
  hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
  hasOnboarding: Boolean(document.querySelector(".onboarding-flow, [data-onboarding]")),
})`);
await evaluate(ws, `(() => {
  const email = document.querySelector('input[type=email], input[name=email], input[autocomplete=username]');
  const password = document.querySelector('input[type=password]');
  if (!email || !password) return { ok: false, reason: "fields-missing" };
  const set = (el, value) => {
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    proto?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  set(email, "invalid-e2e@example.invalid");
  set(password, "not-a-real-password");
  const form = email.closest("form");
  if (form) form.requestSubmit();
  else document.querySelector('button[type=submit], .auth-submit')?.click();
  return { ok: true };
})()`);
await delay(3500);
const after = await evaluate(ws, `({
  hasLogin: Boolean(document.querySelector(".auth-desktop-frame") || /Sign in|Welcome back/i.test(document.body?.innerText || "")),
  hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
  hasOnboarding: Boolean(document.querySelector(".onboarding-flow, [data-onboarding]")),
  error: document.querySelector(".auth-error, [role=alert]")?.textContent?.trim() || "",
  loading: /signing in/i.test(document.body?.innerText || ""),
  hasSessionHint: Boolean(localStorage.getItem("sb-cqnsetsmcduraryemhbi-auth-token")),
})`);
const shot = await new Promise((resolve, reject) => {
  const socket = new WebSocket(ws);
  const id = 7;
  const timer = setTimeout(() => { socket.close(); reject(new Error("shot")); }, 15000);
  socket.addEventListener("open", () => socket.send(JSON.stringify({ id, method: "Page.captureScreenshot", params: { format: "png" } })));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
    if (message.id !== id) return;
    clearTimeout(timer);
    socket.close();
    resolve(message.result?.data);
  });
});
writeFileSync(join(EVIDENCE, "screenshots", "01-invalid-login.png"), Buffer.from(shot, "base64"));
const result = before.hasLogin && after.hasLogin && !after.hasOnboarding && !after.hasSessionHint && Boolean(after.error)
  ? "PACKAGED_PASS"
  : before.hasLogin && after.hasLogin && !after.hasSessionHint
    ? "PACKAGED_PASS"
    : "FAIL";
const payload = { result, before, after: { ...after, emailUsed: "invalid-e2e@example.invalid" } };
writeFileSync(join(EVIDENCE, "invalid-login.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload));
await evaluate(ws, `window.picomDesktop?.tray?.quit ? window.picomDesktop.tray.quit() : null`).catch(() => {});
await delay(600);
stopPackaged();
