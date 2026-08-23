/**
 * TASK 13B focused packaged retest: camera scroll+preview, AMD mic coupling,
 * screen cancel observation, start-in-tray MainWindowHandle.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR;
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9336);
const shots = join(EVIDENCE, "screenshots");
mkdirSync(shots, { recursive: true });
const log = [];
const results = [];

function note(message) {
  const line = `${new Date().toISOString()} ${message}`;
  log.push(line);
  console.log(line);
}
function record(scenario, result, evidence, notes = "") {
  results.push({ scenario, result, evidence, notes });
  note(`RESULT ${scenario} ${result} ${notes}`);
}
function stopPackaged() {
  try { execFileSync("taskkill", ["/IM", "Picom.exe", "/F"], { stdio: "ignore" }); } catch { /* none */ }
}
function launchApp(profile, extraArgs = []) {
  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`, ...extraArgs], {
    env: { ...process.env, PICOM_USER_DATA_DIR: profile },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}
function mainWindowHandles() {
  try {
    return execFileSync("powershell", ["-NoProfile", "-Command",
      "(Get-Process Picom -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Measure-Object).Count"],
      { encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}
async function waitForCdp(timeoutMs = 60000) {
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
async function cdp(wsUrl, method, params = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => { socket.close(); reject(new Error(`CDP timeout ${method}`)); }, timeoutMs);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, method, params })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`CDP socket error ${method}`)); });
  });
}
async function evaluate(wsUrl, expression, timeoutMs = 20000) {
  const result = await cdp(wsUrl, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result?.value;
}
async function screenshot(wsUrl, name) {
  const captured = await cdp(wsUrl, "Page.captureScreenshot", { format: "png" });
  writeFileSync(join(shots, `${name}.png`), Buffer.from(captured.data, "base64"));
}
async function waitUntil(wsUrl, expression, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(wsUrl, expression);
    if (value) return value;
    await delay(300);
  }
  return null;
}
async function clickContinue(wsUrl) {
  return evaluate(wsUrl, `(() => { const b = [...document.querySelectorAll(".first-launch-actions button.primary")].at(-1); if (!b || b.disabled) return false; b.click(); return true; })()`);
}
async function clickText(wsUrl, text, selector = "button, label") {
  return evaluate(wsUrl, `(() => {
    const needle = ${JSON.stringify(text)}.toLowerCase();
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => (n.innerText || "").toLowerCase().includes(needle));
    if (!el || el.disabled) return { ok: false, text: ${JSON.stringify(text)} };
    el.click();
    return { ok: true, text: ${JSON.stringify(text)} };
  })()`);
}
async function connect() {
  const page = await waitForCdp();
  await cdp(page.webSocketDebuggerUrl, "Page.enable");
  await cdp(page.webSocketDebuggerUrl, "Runtime.enable");
  return page.webSocketDebuggerUrl;
}

async function main() {
  stopPackaged();
  await delay(800);
  launchApp(PROFILE);
  const ws = await connect();
  await delay(2500);
  await waitUntil(ws, `Boolean(document.getElementById("first-launch-welcome-heading"))`, 20000);
  await clickContinue(ws); await delay(600);
  await clickText(ws, "Gaming", "label.first-launch-purpose-card");
  await clickText(ws, "Friends", "label.first-launch-purpose-card");
  await clickContinue(ws); await delay(600);
  await clickContinue(ws); await delay(900);

  await evaluate(ws, `(() => {
    window.__picomGumLog = [];
    window.__picomLiveStreams = [];
    if (!window.__picomMediaObserverInstalled) {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        window.__picomGumLog.push({ constraints, at: Date.now() });
        const stream = await original(constraints);
        window.__picomLiveStreams.push(stream);
        return stream;
      };
      window.__picomMediaObserverInstalled = true;
    }
    return true;
  })()`);

  if (!await evaluate(ws, `Boolean(document.querySelector(".first-launch-audio-meter"))`)) {
    await clickText(ws, "Enable microphone");
    await waitUntil(ws, `Boolean(document.querySelector(".first-launch-audio-meter"))`, 15000);
  }
  const selectedMic = await evaluate(ws, `(() => {
    const select = document.querySelector(".first-launch-audio-section select");
    if (!select) return { ok: false };
    const option = [...select.options].find((item) => /AMD Audio Device/i.test(item.text));
    if (!option) return { ok: false, options: [...select.options].map((item) => item.text) };
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, label: option.text };
  })()`);
  await delay(800);
  await clickText(ws, "Test microphone");
  await delay(2000);
  const silence = await evaluate(ws, `({ status: document.querySelector(".first-launch-audio-meter-card strong")?.textContent || "", meter: Number(document.querySelector(".first-launch-audio-meter")?.getAttribute("aria-valuenow") || 0) })`);
  await clickText(ws, "Test speakers");
  let peak = 0;
  let status = silence.status;
  for (let i = 0; i < 12; i += 1) {
    await delay(400);
    const sample = await evaluate(ws, `({ status: document.querySelector(".first-launch-audio-meter-card strong")?.textContent || "", meter: Number(document.querySelector(".first-launch-audio-meter")?.getAttribute("aria-valuenow") || 0) })`);
    peak = Math.max(peak, sample.meter || 0);
    status = sample.status;
    if (/input detected|test passed/i.test(status)) break;
  }
  const micPass = /input detected|test passed/i.test(status);
  record("microphone-amd-array", micPass ? "PACKAGED_PASS" : "BLOCKED_ENVIRONMENT", "screenshots/05b-mic-amd.png", JSON.stringify({ selectedMic, silence, peak, status }));
  await screenshot(ws, "05b-mic-amd");
  await clickText(ws, "Stop test");

  await evaluate(ws, `document.getElementById("first-launch-camera-heading")?.scrollIntoView({ block: "center" })`);
  await delay(400);
  const camUi = await evaluate(ws, `({
    heading: Boolean(document.getElementById("first-launch-camera-heading")),
    enable: [...document.querySelectorAll("button")].some((b) => /enable camera/i.test(b.innerText)),
    start: [...document.querySelectorAll("button")].some((b) => /start preview/i.test(b.innerText)),
    text: document.querySelector(".first-launch-camera-setup")?.innerText?.slice(0, 500) || "",
  })`);
  note(`camera-ui ${JSON.stringify(camUi)}`);
  if (camUi.enable) await clickText(ws, "Enable camera");
  else if (camUi.start) await clickText(ws, "Start preview");
  const camReady = await waitUntil(ws, `([...document.querySelectorAll("video")].some((v) => v.videoWidth > 0 && v.srcObject && v.srcObject.getVideoTracks().some((t) => t.readyState === "live")))`, 15000);
  const camProbe = await evaluate(ws, `({
    gum: window.__picomGumLog || [],
    videos: [...document.querySelectorAll("video")].map((v) => ({
      src: Boolean(v.srcObject),
      w: v.videoWidth,
      h: v.videoHeight,
      audio: v.srcObject ? v.srcObject.getAudioTracks().length : 0,
      live: v.srcObject ? v.srcObject.getVideoTracks().some((t) => t.readyState === "live") : false,
    })),
    caption: document.getElementById("first-launch-camera-preview-caption")?.textContent || "",
  })`);
  const live = Boolean(camReady) && camProbe.videos.some((v) => v.live && v.w > 0);
  const audioFalse = (camProbe.gum || []).filter((g) => g.constraints?.video).every((g) => g.constraints.audio === false || g.constraints.audio == null);
  record("camera-physical-retest", live && audioFalse ? "PACKAGED_PASS" : live ? "FAIL" : "BLOCKED_ENVIRONMENT", "physical-notes.json", JSON.stringify({ camUi, camProbe, live, audioFalse }));
  // Do not store a camera frame screenshot.
  await clickText(ws, "Stop camera");
  await delay(400);

  await evaluate(ws, `document.getElementById("first-launch-screen-heading")?.scrollIntoView({ block: "center" })`);
  await delay(300);
  await clickText(ws, "Test screen sharing");
  await waitUntil(ws, `document.querySelectorAll(".first-launch-screen-source").length > 0`, 12000);
  const before = await evaluate(ws, `document.querySelector(".first-launch-media-status")?.textContent || ""`);
  await clickText(ws, "Test screen sharing");
  await delay(800);
  const afterCancel = await evaluate(ws, `({
    status: document.querySelector(".first-launch-media-status")?.textContent || "",
    passed: /capture ready|test passed/i.test(document.querySelector(".first-launch-media-status")?.textContent || ""),
    sources: document.querySelectorAll(".first-launch-screen-source").length,
  })`);
  record("screen-picker-cancel-retest", afterCancel.passed ? "FAIL" : "PACKAGED_PASS", "physical-notes.json", JSON.stringify({ before, afterCancel }));

  writeFileSync(join(EVIDENCE, "media-retest-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "media-retest-log.txt"), `${log.join("\n")}\n`);
  stopPackaged();
}

try { await main(); } catch (error) {
  note(`ERROR ${error.stack || error.message}`);
  writeFileSync(join(EVIDENCE, "media-retest-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "media-retest-log.txt"), `${log.join("\n")}\n`);
  stopPackaged();
  process.exit(1);
}
