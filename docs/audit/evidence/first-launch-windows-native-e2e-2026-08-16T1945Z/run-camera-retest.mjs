/**
 * TASK 13B camera-only packaged retest on the media isolated profile.
 * Profile already has first-run at Audio after previous media retest.
 */
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR;
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9338);

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
async function evaluate(wsUrl, expression, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => { socket.close(); reject(new Error("timeout")); }, timeoutMs);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message));
      else if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text || "eval"));
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

const step = await evaluate(ws, `({
  hasAudio: Boolean(document.querySelector(".first-launch-audio-setup") || document.getElementById("first-launch-camera-heading")),
  heading: document.querySelector("h1, h2")?.textContent || "",
  current: document.querySelector("[aria-current=step]")?.textContent || "",
})`);
console.log("step", JSON.stringify(step));

await evaluate(ws, `document.getElementById("first-launch-camera-heading")?.scrollIntoView({ block: "center" })`);
await delay(400);
await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /stop test|stop camera/i.test(b.innerText))?.click()`);
await delay(400);

const selected = await evaluate(ws, `(() => {
  const select = document.querySelector(".first-launch-camera-setup select");
  if (!select) return { ok: false, reason: "no-select" };
  const option = [...select.options].find((item) => /ACER HD User Facing/i.test(item.text)) || [...select.options][0];
  if (!option) return { ok: false, reason: "no-option", options: [...select.options].map((i) => i.text) };
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, label: option.text, count: select.options.length };
})()`);
console.log("selected", JSON.stringify(selected));
await delay(600);

await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /start preview|enable camera|try again/i.test(b.innerText))?.click()`);
await delay(3000);
const probe1 = await evaluate(ws, `({
  status: document.querySelector(".first-launch-camera-setup .first-launch-media-status")?.textContent || "",
  error: document.querySelector(".first-launch-camera-setup .first-launch-audio-error, .first-launch-camera-setup [role=alert]")?.textContent || "",
  caption: document.getElementById("first-launch-camera-preview-caption")?.textContent || "",
  videos: [...document.querySelectorAll(".first-launch-camera-setup video, video")].map((v) => ({
    src: Boolean(v.srcObject),
    w: v.videoWidth,
    h: v.videoHeight,
    live: v.srcObject ? v.srcObject.getVideoTracks().some((t) => t.readyState === "live") : false,
    audio: v.srcObject ? v.srcObject.getAudioTracks().length : 0,
    settings: v.srcObject ? v.srcObject.getVideoTracks().map((t) => t.getSettings()) : [],
  })),
  liveTracks: (window.__picomLiveStreams || []).flatMap((s) => s.getVideoTracks().map((t) => ({ state: t.readyState, w: t.getSettings()?.width || 0, h: t.getSettings()?.height || 0 }))),
})`);
console.log("probe1", JSON.stringify(probe1));

if (!probe1.videos.some((v) => v.live && v.w > 0) && !probe1.liveTracks.some((t) => t.state === "live" && t.w > 0)) {
  await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /stop camera/i.test(b.innerText))?.click()`);
  await delay(800);
  await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /start preview|try again|enable camera/i.test(b.innerText))?.click()`);
  await delay(4000);
}
const probe2 = await evaluate(ws, `({
  status: document.querySelector(".first-launch-camera-setup .first-launch-media-status")?.textContent || "",
  error: document.querySelector(".first-launch-camera-setup .first-launch-audio-error, .first-launch-camera-setup [role=alert]")?.textContent || "",
  caption: document.getElementById("first-launch-camera-preview-caption")?.textContent || "",
  videos: [...document.querySelectorAll("video")].map((v) => ({
    src: Boolean(v.srcObject),
    w: v.videoWidth,
    h: v.videoHeight,
    live: v.srcObject ? v.srcObject.getVideoTracks().some((t) => t.readyState === "live") : false,
    audio: v.srcObject ? v.srcObject.getAudioTracks().length : 0,
  })),
})`);
console.log("probe2", JSON.stringify(probe2));

const live = probe1.videos.some((v) => v.live && v.w > 0) || probe2.videos.some((v) => v.live && v.w > 0)
  || probe1.liveTracks.some((t) => t.state === "live" && t.w > 0);
const audioLeak = probe1.videos.some((v) => v.audio > 0) || probe2.videos.some((v) => v.audio > 0);
const result = live && !audioLeak ? "PACKAGED_PASS" : /in use|blocked|denied/i.test(`${probe1.status} ${probe1.error} ${probe2.status} ${probe2.error}`) ? "BLOCKED_ENVIRONMENT" : "FAIL";

await evaluate(ws, `document.getElementById("first-launch-screen-heading")?.scrollIntoView({ block: "center" })`);
await delay(300);
await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /test screen sharing/i.test(b.innerText))?.click()`);
await delay(1500);
const picker = await evaluate(ws, `({
  status: [...document.querySelectorAll(".first-launch-screen-preflight .first-launch-media-status")].at(-1)?.textContent || "",
  sources: [...document.querySelectorAll(".first-launch-screen-source")].map((b) => ({ name: b.querySelector("strong")?.textContent || "", type: b.querySelector("small")?.textContent || "" })),
})`);
await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /test screen sharing/i.test(b.innerText))?.click()`);
await delay(1000);
const cancel = await evaluate(ws, `({
  status: [...document.querySelectorAll(".first-launch-screen-preflight .first-launch-media-status")].at(-1)?.textContent || "",
  sources: document.querySelectorAll(".first-launch-screen-source").length,
  videoLive: [...document.querySelectorAll(".first-launch-screen-preflight video")].some((v) => v.srcObject && v.videoWidth > 0),
})`);

await evaluate(ws, `[...document.querySelectorAll("button")].find((b) => /stop camera/i.test(b.innerText))?.click()`);
const payload = { result, selected, probe1, probe2, live, audioLeak, picker, cancel };
writeFileSync(join(EVIDENCE, "camera-retest.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ result, live, audioLeak, status: probe2.status, error: probe2.error, cancel }));
await evaluate(ws, `window.picomDesktop?.tray?.quit ? window.picomDesktop.tray.quit() : null`).catch(() => {});
await delay(600);
stopPackaged();
if (result === "FAIL") process.exit(1);
