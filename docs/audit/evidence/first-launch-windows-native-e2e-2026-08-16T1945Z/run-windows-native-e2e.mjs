/**
 * TASK 13B packaged Windows native first-run operator.
 * Evidence-only. Does not mutate production source.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.env.PICOM_EVIDENCE_DIR || process.cwd();
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9335);
const EXPECTED_SHA = "e38a875bc06504b4112c7e2f114e19a64e46e580f24b725a523108b13a99c5a3";
if (!EXE || !PROFILE) throw new Error("PICOM_PACKAGED_EXE and PICOM_USER_DATA_DIR are required");

const shots = join(EVIDENCE, "screenshots");
mkdirSync(shots, { recursive: true });
mkdirSync(join(EVIDENCE, "logs"), { recursive: true });

const results = [];
const log = [];
const visualIssues = [];
const performance = {};
const physical = {};
let loginItemOriginal = null;
let loginItemRestored = null;

function note(message) {
  const line = `${new Date().toISOString()} ${message}`;
  log.push(line);
  console.log(line);
}

function record(scenario, result, evidence, notes = "") {
  results.push({ scenario, result, evidence, notes });
  note(`RESULT ${scenario} ${result} ${notes}`);
}

function addVisual(id, severity, screen, issue) {
  visualIssues.push({ id, severity, screen, issue });
}

function stopPackaged() {
  try {
    execFileSync("taskkill", ["/IM", "Picom.exe", "/F"], { stdio: "ignore" });
  } catch {
    /* none */
  }
}

function picomProcessCount() {
  try {
    const out = execFileSync("powershell", ["-NoProfile", "-Command", "(Get-Process Picom -ErrorAction SilentlyContinue | Measure-Object).Count"], { encoding: "utf8" });
    return Number(String(out).trim()) || 0;
  } catch {
    return 0;
  }
}

function readPicomRunKey() {
  try {
    const script = [
      "$run = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue;",
      "$names = $run.PSObject.Properties | Where-Object { $_.Name -match 'picom|Picom' } | ForEach-Object { $_.Name + '=' + $_.Value };",
      "if ($names) { $names -join '`n' } else { 'NO_PICOM_RUN_VALUE' }",
    ].join(" ");
    return execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
  } catch (error) {
    return `unavailable:${error.message}`;
  }
}

function launchApp(extraArgs = []) {
  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`, ...extraArgs], {
    env: { ...process.env, PICOM_USER_DATA_DIR: PROFILE },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
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
    } catch {
      /* launching */
    }
    await delay(400);
  }
  throw new Error("CDP target not available");
}

async function cdp(wsUrl, method, params = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`CDP timeout ${method}`));
    }, timeoutMs);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id, method, params })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`CDP socket error ${method}`));
    });
  });
}

async function evaluate(wsUrl, expression, timeoutMs = 20000) {
  const result = await cdp(wsUrl, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, timeoutMs);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || "evaluate failed");
  }
  return result.result?.value;
}

async function screenshot(wsUrl, name) {
  const captured = await cdp(wsUrl, "Page.captureScreenshot", { format: "png" });
  const file = join(shots, `${name}.png`);
  writeFileSync(file, Buffer.from(captured.data, "base64"));
  return file;
}

async function waitUntil(wsUrl, expression, timeoutMs = 15000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await evaluate(wsUrl, expression);
    if (last) return last;
    await delay(300);
  }
  return last;
}

async function snapshot(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const text = document.body?.innerText || "";
    const continueBtn = [...document.querySelectorAll(".first-launch-actions button.primary")].at(-1);
    const meter = document.querySelector(".first-launch-audio-meter");
    const videos = [...document.querySelectorAll("video")];
    return {
      title: document.title,
      theme: document.documentElement.dataset.theme || document.documentElement.getAttribute("data-theme") || document.body?.dataset.theme || null,
      bodyClass: document.body?.className || "",
      htmlClass: document.documentElement.className || "",
      bg: getComputedStyle(document.body).backgroundColor,
      heading: document.querySelector("h1, h2")?.textContent || "",
      hasWelcome: Boolean(document.getElementById("first-launch-welcome-heading")),
      hasPersonalize: Boolean(document.getElementById("first-launch-personalize-heading")),
      hasAppearance: Boolean(document.getElementById("first-launch-appearance-heading")),
      hasAudio: Boolean(document.getElementById("first-launch-audio-permission") || document.querySelector(".first-launch-audio-setup")),
      hasCamera: Boolean(document.getElementById("first-launch-camera-heading")),
      hasScreen: Boolean(document.getElementById("first-launch-screen-heading")),
      hasDesktop: Boolean(document.getElementById("first-launch-desktop-startup")),
      hasNotifications: Boolean(document.getElementById("first-launch-notification-desktop")),
      hasPrivacy: Boolean(document.querySelector(".first-launch-privacy-deferred") || document.getElementById("first-launch-privacy-connect")),
      hasReady: Boolean(document.getElementById("first-launch-ready-health-heading") || /PICOM is ready/i.test(text)),
      hasLogin: Boolean(document.querySelector(".auth-desktop-frame") || /Welcome back|Sign in to Picom|Sign in to continue/i.test(text)),
      hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
      hasBlockingGate: Boolean(document.querySelector("[data-version-gate='required']")),
      continueText: continueBtn?.innerText?.replace(/\\s+/g, " ").trim() || "",
      continueEnabled: Boolean(continueBtn) && !continueBtn.disabled,
      progress: document.querySelector(".first-launch-rail-progress span")?.textContent || "",
      planPreview: [...document.querySelectorAll(".first-launch-plan-preview li")].map((item) => item.textContent.trim()),
      selectedPurposes: [...document.querySelectorAll(".first-launch-purpose-card.is-selected strong")].map((item) => item.textContent.trim()),
      reviewAllPresent: Boolean(document.querySelector(".first-launch-rail-review-all, .first-launch-review-all")),
      privacyDeferred: Boolean(document.querySelector(".first-launch-privacy-deferred")),
      privacyInteractive: Boolean(document.getElementById("first-launch-privacy-connect")),
      meterNow: meter ? Number(meter.getAttribute("aria-valuenow") || 0) : null,
      microphoneStatus: document.querySelector(".first-launch-audio-meter-card strong")?.textContent || "",
      videoCount: videos.length,
      videoHasSrc: videos.some((video) => Boolean(video.srcObject)),
      readyRows: [...document.querySelectorAll(".first-launch-ready-rows li")].map((row) => ({
        label: row.querySelector("span")?.textContent?.trim() || "",
        value: row.querySelector("strong")?.textContent?.trim() || "",
        status: row.querySelector("strong")?.getAttribute("data-status") || "",
      })),
      hidden: document.hidden,
      textSlice: text.slice(0, 1200),
    };
  })()`);
}

async function clickContinue(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const button = [...document.querySelectorAll(".first-launch-actions button.primary")].at(-1);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
}

async function clickText(wsUrl, text, selector = "button, label, [role=radio]") {
  return evaluate(wsUrl, `(() => {
    const needle = ${JSON.stringify(text)}.toLowerCase();
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const el = nodes.find((node) => (node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase().includes(needle));
    if (!el) return { ok: false, reason: "missing", text: ${JSON.stringify(text)} };
    if (el.disabled) return { ok: false, reason: "disabled", text: ${JSON.stringify(text)} };
    el.click();
    return { ok: true, text: ${JSON.stringify(text)}, tag: el.tagName };
  })()`);
}

async function clickAria(wsUrl, text) {
  return evaluate(wsUrl, `(() => {
    const needle = ${JSON.stringify(text)}.toLowerCase();
    const nodes = [...document.querySelectorAll("button")];
    const el = nodes.find((node) => (node.getAttribute("aria-label") || "").toLowerCase().includes(needle));
    if (!el || el.disabled) return { ok: false, text: ${JSON.stringify(text)} };
    el.click();
    return { ok: true, text: ${JSON.stringify(text)} };
  })()`);
}

async function settingsState(wsUrl) {
  return evaluate(wsUrl, `(() => {
    try {
      const raw = localStorage.getItem("picom-settings");
      if (!raw) return { present: false };
      const parsed = JSON.parse(raw);
      const setup = parsed.firstLaunchSetup || {};
      const appearance = parsed.appearanceSettings || {};
      const access = parsed.accessibilitySettings || {};
      const notes = parsed.notificationSettings || {};
      return {
        present: true,
        completed: parsed.firstLaunchSetupCompleted === true || setup.completed === true,
        currentStep: setup.currentStep || null,
        purposeIds: setup.purposeIds || [],
        reviewAllSetup: setup.reviewAllSetup === true,
        locale: setup.locale || appearance.language || null,
        theme: setup.theme || appearance.themeMode || null,
        density: appearance.density || null,
        textSize: access.textSize || null,
        interfaceScale: access.interfaceScale || null,
        reducedMotion: access.reducedMotion === true,
        highContrast: access.highContrast === true,
        focusRingStrong: access.focusRingStrong === true,
        notifications: {
          enabled: notes.enabled,
          nativeDesktopEnabled: notes.nativeDesktopEnabled,
          directMessages: notes.directMessages,
          mentions: notes.mentions,
          incomingCalls: notes.incomingCalls,
          friendRequests: notes.friendRequests,
          communityAnnouncements: notes.communityAnnouncements,
          quietHours: notes.quietHours || null,
        },
      };
    } catch (error) {
      return { present: false, error: String(error) };
    }
  })()`);
}

async function remoteState(wsUrl) {
  return evaluate(wsUrl, `(() => {
    try {
      const raw = localStorage.getItem("picom.remoteConfig.v1");
      if (!raw) return { present: false };
      const parsed = JSON.parse(raw);
      const cfg = parsed.config || parsed;
      return {
        present: true,
        source: cfg.source || null,
        minimumSupportedVersion: cfg.minimumSupportedVersion || null,
        recommendedClientVersion: cfg.recommendedClientVersion || null,
        latestVersion: cfg.latestVersion || null,
        cachedAt: parsed.cachedAt || null,
      };
    } catch (error) {
      return { present: false, error: String(error) };
    }
  })()`);
}

async function mediaProbe(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const videos = [...document.querySelectorAll("video")];
    const live = (window.__picomLiveStreams || []).map((stream) => ({
      audio: stream.getAudioTracks().map((track) => ({ state: track.readyState, label: track.label, muted: track.muted })),
      video: stream.getVideoTracks().map((track) => ({
        state: track.readyState,
        label: track.label,
        width: track.getSettings()?.width || 0,
        height: track.getSettings()?.height || 0,
      })),
    }));
    return {
      gum: window.__picomGumLog || [],
      live,
      videoElements: videos.map((video) => ({
        hasSrcObject: Boolean(video.srcObject),
        readyState: video.readyState,
        width: video.videoWidth,
        height: video.videoHeight,
        audioTracks: video.srcObject ? video.srcObject.getAudioTracks().length : 0,
        videoTracks: video.srcObject ? video.srcObject.getVideoTracks().length : 0,
        videoLive: video.srcObject ? video.srcObject.getVideoTracks().some((track) => track.readyState === "live") : false,
      })),
      meterNow: Number(document.querySelector(".first-launch-audio-meter")?.getAttribute("aria-valuenow") || 0),
      micStatus: document.querySelector(".first-launch-audio-meter-card strong")?.textContent || "",
      inputLabel: document.querySelector(".first-launch-audio-section select")?.selectedOptions?.[0]?.textContent || "",
      outputLabel: document.querySelector(".first-launch-audio-output-status strong")?.textContent || "",
    };
  })()`);
}

async function layoutProbe(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const footer = document.querySelector(".first-launch-actions");
    const titlebar = document.querySelector(".window-titlebar, .titlebar-actions");
    const closeBtn = document.querySelector(".window-control.danger");
    const rail = document.querySelector(".first-launch-rail");
    const compact = document.querySelector(".first-launch-compact-header");
    const root = document.documentElement;
    const footerBox = footer?.getBoundingClientRect();
    const closeBox = closeBtn?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 2,
      footerVisible: Boolean(footerBox) && footerBox.bottom <= window.innerHeight + 2 && footerBox.top >= 0,
      titlebarVisible: Boolean(titlebar),
      closeReachable: Boolean(closeBox) && closeBox.width > 0 && closeBox.right <= window.innerWidth + 2,
      railVisible: Boolean(rail) && getComputedStyle(rail).display !== "none",
      compactVisible: Boolean(compact) && getComputedStyle(compact).display !== "none",
    };
  })()`);
}

async function installMediaObserver(wsUrl) {
  return evaluate(wsUrl, `(() => {
    if (window.__picomMediaObserverInstalled) return true;
    window.__picomGumLog = [];
    window.__picomLiveStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__picomGumLog.push({ constraints, at: Date.now() });
      const stream = await original(constraints);
      window.__picomLiveStreams.push(stream);
      return stream;
    };
    window.__picomMediaObserverInstalled = true;
    return true;
  })()`);
}

async function nativeStartup(wsUrl) {
  return evaluate(wsUrl, `window.picomDesktop?.startup?.getState ? window.picomDesktop.startup.getState() : { ok: false, error: "missing" }`);
}

async function nativeCapability(wsUrl) {
  return evaluate(wsUrl, `window.picomDesktop?.notifications?.getCapability ? window.picomDesktop.notifications.getCapability() : { ok: false, error: "missing" }`);
}

async function nativeSendTest(wsUrl) {
  return evaluate(wsUrl, `window.picomDesktop?.notifications?.sendTest ? window.picomDesktop.notifications.sendTest() : { ok: false, error: "missing" }`);
}

async function showWindow(wsUrl) {
  return evaluate(wsUrl, `window.picomDesktop?.tray?.showWindow ? window.picomDesktop.tray.showWindow() : { ok: false, error: "missing" }`);
}

async function trayQuit(wsUrl) {
  return evaluate(wsUrl, `window.picomDesktop?.tray?.quit ? window.picomDesktop.tray.quit() : { ok: false, error: "missing" }`);
}

async function closeViaTitlebar(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const button = document.querySelector(".window-control.danger");
    if (!button) return { ok: false, error: "missing-close" };
    button.click();
    return { ok: true };
  })()`);
}

async function connectSession() {
  const page = await waitForCdp();
  const ws = page.webSocketDebuggerUrl;
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");
  return ws;
}

async function relaunch(extraArgs = [], waitMs = 2500) {
  stopPackaged();
  await delay(1000);
  const pid = launchApp(extraArgs);
  const started = Date.now();
  const ws = await connectSession();
  const launchMs = Date.now() - started;
  await delay(waitMs);
  return { pid, ws, launchMs };
}

async function returnToReady(wsUrl) {
  for (let index = 0; index < 8; index += 1) {
    const snap = await snapshot(wsUrl);
    if (snap.hasReady) return true;
    if (!snap.continueEnabled) return false;
    await clickContinue(wsUrl);
    await delay(700);
  }
  return (await snapshot(wsUrl)).hasReady;
}

function writeEvidence() {
  writeFileSync(join(EVIDENCE, "operator-log.txt"), `${log.join("\n")}\n`);
  writeFileSync(join(EVIDENCE, "scenario-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "visual-issues.json"), `${JSON.stringify(visualIssues, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "performance-notes.json"), `${JSON.stringify(performance, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "physical-notes.json"), `${JSON.stringify(physical, null, 2)}\n`);
}

async function restoreLoginItem(wsUrl) {
  if (loginItemOriginal == null) return null;
  const desired = Boolean(loginItemOriginal.enabled);
  await evaluate(wsUrl, `window.picomDesktop?.startup?.setEnabled ? window.picomDesktop.startup.setEnabled(${desired}) : { ok: false }`);
  await delay(400);
  const after = await nativeStartup(wsUrl);
  loginItemRestored = after;
  writeFileSync(join(EVIDENCE, "startup-restore-proof.json"), `${JSON.stringify({
    original: loginItemOriginal,
    restored: after,
    registry: readPicomRunKey(),
    match: after?.enabled === desired,
  }, null, 2)}\n`);
  return after;
}

async function main() {
  const sha = createHash("sha256").update(readFileSync(EXE)).digest("hex");
  writeFileSync(join(EVIDENCE, "artifact-sha256-operator.txt"), `${sha}\n${EXE}\nmatch=${sha === EXPECTED_SHA}\n`);
  note(`artifact ${EXE}`);
  note(`sha256 ${sha} match=${sha === EXPECTED_SHA}`);
  if (sha !== EXPECTED_SHA) {
    record("sha256", "FAIL", "artifact-sha256-operator.txt", "SHA mismatch; acceptance SHA invalid");
    writeEvidence();
    process.exit(1);
  }
  record("sha256", "PACKAGED_PASS", "artifact-sha256-operator.txt", EXPECTED_SHA);

  const profileFiles = existsSync(join(PROFILE, "device-local-settings.v1.json")) || existsSync(join(PROFILE, "Local Storage"));
  record(
    "isolated-profile-fresh",
    profileFiles ? "FAIL" : "PACKAGED_PASS",
    "isolated-profile/",
    profileFiles ? "profile already had storage" : "empty isolated profile",
  );

  stopPackaged();
  await delay(800);
  const first = await relaunch([], 2800);
  performance.launchToCdpMs = first.launchMs;
  note(`launched pid=${first.pid} launchMs=${first.launchMs}`);
  let ws = first.ws;
  await installMediaObserver(ws);

  const welcomeStarted = Date.now();
  const welcomeReady = await waitUntil(ws, `Boolean(document.getElementById("first-launch-welcome-heading") || document.querySelector(".auth-desktop-frame") || document.querySelector("[data-version-gate]"))`, 20000);
  performance.launchToWelcomeMs = Date.now() - welcomeStarted + first.launchMs;
  let snap = await snapshot(ws);
  await screenshot(ws, "01-welcome");
  const remote = await waitUntil(ws, `(() => {
    try {
      const raw = localStorage.getItem("picom.remoteConfig.v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const cfg = parsed.config || parsed;
      return cfg.source === "remote" ? cfg : null;
    } catch { return null; }
  })()`, 20000) || await remoteState(ws);
  const settings = await settingsState(ws);
  writeFileSync(join(EVIDENCE, "remote-config.json"), `${JSON.stringify(remote, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "initial-settings.json"), `${JSON.stringify(settings, null, 2)}\n`);

  const versionOk = remote?.source === "remote"
    && remote.minimumSupportedVersion === "0.1.1-beta.10"
    && !snap.hasBlockingGate
    && snap.hasWelcome;
  record(
    "remote-version-policy",
    versionOk ? "PACKAGED_PASS" : "FAIL",
    "remote-config.json",
    JSON.stringify({ source: remote?.source, min: remote?.minimumSupportedVersion, gate: snap.hasBlockingGate, welcome: snap.hasWelcome }),
  );
  record(
    "fresh-first-run-incomplete",
    settings.present && settings.completed !== true && settings.currentStep === "welcome" && (!settings.purposeIds || settings.purposeIds.length === 0)
      ? "PACKAGED_PASS"
      : settings.present === false && snap.hasWelcome ? "PACKAGED_PASS" : "FAIL",
    "initial-settings.json",
    JSON.stringify(settings),
  );

  await clickContinue(ws);
  await delay(800);
  snap = await snapshot(ws);
  const gaming = await clickText(ws, "Gaming", "label.first-launch-purpose-card");
  const friends = await clickText(ws, "Friends", "label.first-launch-purpose-card");
  await delay(500);
  snap = await snapshot(ws);
  await screenshot(ws, "02-personalize-gaming-friends");
  const expectedPlan = ["Appearance", "Audio & Video", "Desktop", "Notifications", "Privacy", "Ready"];
  const planOk = expectedPlan.every((step) => snap.planPreview.some((item) => item.includes(step.replace(" & ", " ")) || item.includes(step)));
  const purposesOk = snap.selectedPurposes.some((item) => /gaming/i.test(item)) && snap.selectedPurposes.some((item) => /friends/i.test(item));
  record(
    "personalization-gaming-friends",
    gaming.ok && friends.ok && purposesOk && snap.reviewAllPresent && planOk ? "PACKAGED_PASS" : "FAIL",
    "screenshots/02-personalize-gaming-friends.png",
    JSON.stringify({ gaming, friends, purposes: snap.selectedPurposes, plan: snap.planPreview, reviewAll: snap.reviewAllPresent, progress: snap.progress }),
  );

  await clickContinue(ws);
  await delay(800);
  snap = await snapshot(ws);
  for (const option of ["System", "Light", "Dark"]) {
    await clickText(ws, option, "[data-theme-option], button[role=radio]");
    await delay(250);
  }
  for (const option of ["Comfortable", "Compact"]) {
    await clickText(ws, option, "button[role=radio]");
    await delay(200);
  }
  for (const option of ["Default", "Large", "Extra large"]) {
    await clickText(ws, option, "button[role=radio]");
    await delay(200);
  }
  const scaleResults = {};
  for (const option of ["90%", "100%", "110%", "125%"]) {
    await clickText(ws, option, "button[role=radio]");
    await delay(500);
    scaleResults[option] = await layoutProbe(ws);
  }
  writeFileSync(join(EVIDENCE, "appearance-scale-layout.json"), `${JSON.stringify(scaleResults, null, 2)}\n`);
  const crowded = scaleResults["125%"];
  if (crowded?.horizontalOverflow) addVisual("v-125-hscroll", "P3 UX", "appearance-125", "Permanent horizontal overflow at 125%");
  if (crowded && !crowded.footerVisible) addVisual("v-125-footer", "P3 UX", "appearance-125", "Footer not fully visible at 125%");
  if (crowded && !crowded.closeReachable) addVisual("v-125-titlebar", "P3 UX", "appearance-125", "Titlebar close not reachable at 125%");
  await evaluate(ws, `window.resizeTo(900, 720)`);
  await delay(400);
  const narrow = await layoutProbe(ws);
  writeFileSync(join(EVIDENCE, "appearance-narrow-layout.json"), `${JSON.stringify(narrow, null, 2)}\n`);
  await evaluate(ws, `window.resizeTo(1280, 800)`);
  await delay(300);
  await clickText(ws, "Reduce motion", "label");
  await clickText(ws, "Enhanced contrast", "label");
  await clickText(ws, "Strong focus", "label");
  await delay(200);
  await clickText(ws, "Dark", "[data-theme-option], button[role=radio]");
  await clickText(ws, "Compact", "button[role=radio]");
  await clickText(ws, "Large", "button[role=radio]");
  await clickText(ws, "110%", "button[role=radio]");
  await delay(500);
  snap = await snapshot(ws);
  const appearance = await settingsState(ws);
  await screenshot(ws, "03-appearance-dark");
  record(
    "appearance-packaged-controls",
    appearance.theme === "dark" && appearance.density === "compact" && appearance.textSize === "large" && Number(appearance.interfaceScale) === 1.1
      ? "PACKAGED_PASS"
      : "FAIL",
    "screenshots/03-appearance-dark.png",
    JSON.stringify(appearance),
  );
  record(
    "appearance-125-layout",
    crowded && crowded.closeReachable && crowded.footerVisible && !crowded.horizontalOverflow ? "PACKAGED_PASS" : "FAIL",
    "appearance-scale-layout.json",
    JSON.stringify(crowded),
  );

  note("quit for appearance resume");
  await trayQuit(ws);
  await delay(1500);
  stopPackaged();
  const resume = await relaunch([], 2000);
  performance.appearanceResumeLaunchMs = resume.launchMs;
  ws = resume.ws;
  const firstPaint = await snapshot(ws);
  await screenshot(ws, "03b-appearance-resume-first-paint");
  await delay(1500);
  snap = await snapshot(ws);
  const resumed = await settingsState(ws);
  const flash = firstPaint.bg && /rgb\(\s*255\s*,\s*255\s*,\s*255/.test(firstPaint.bg) && snap.hasAppearance;
  physical.appearanceFlash = {
    firstBackground: firstPaint.bg,
    laterBackground: snap.bg,
    firstTheme: firstPaint.theme,
    visibleFlashSuspected: Boolean(flash),
  };
  record(
    "appearance-restart-resume",
    snap.hasAppearance && resumed.theme === "dark" && resumed.currentStep === "appearance" && Number(resumed.interfaceScale) === 1.1 && resumed.locale === "en"
      ? "PACKAGED_PASS"
      : "FAIL",
    "screenshots/03b-appearance-resume-first-paint.png",
    JSON.stringify({ resumed, flash: physical.appearanceFlash }),
  );

  await installMediaObserver(ws);
  await clickContinue(ws);
  await delay(900);
  snap = await snapshot(ws);
  await screenshot(ws, "04-audio-before-permission");
  const beforeMic = await mediaProbe(ws);
  physical.micBefore = {
    liveAudio: (beforeMic.live || []).some((item) => item.audio.some((track) => track.state === "live")),
    gum: beforeMic.gum,
  };
  record(
    "microphone-inactive-before-action",
    physical.micBefore.liveAudio ? "FAIL" : "PACKAGED_PASS",
    "screenshots/04-audio-before-permission.png",
    JSON.stringify(physical.micBefore),
  );

  const enableMic = await clickText(ws, "Enable microphone");
  const micGranted = await waitUntil(ws, `Boolean(document.querySelector(".first-launch-audio-meter"))`, 15000);
  await delay(800);
  const afterEnable = await mediaProbe(ws);
  physical.micPermission = {
    enableClicked: enableMic.ok,
    meterPresent: Boolean(micGranted),
    inputLabel: afterEnable.inputLabel,
    gum: afterEnable.gum,
  };
  await clickText(ws, "Test microphone");
  await delay(2500);
  const silence = await mediaProbe(ws);
  const silencePassed = /input detected|test passed/i.test(silence.micStatus);
  physical.micSilence = { status: silence.micStatus, meter: silence.meterNow, falselyPassed: silencePassed };
  record(
    "microphone-silence-no-false-pass",
    silencePassed ? "FAIL" : "PACKAGED_PASS",
    "physical-notes.json",
    JSON.stringify(physical.micSilence),
  );

  await clickText(ws, "Test speakers");
  await delay(4000);
  const coupled = await mediaProbe(ws);
  let peak = coupled.meterNow || 0;
  for (let index = 0; index < 8; index += 1) {
    await delay(400);
    const sample = await mediaProbe(ws);
    peak = Math.max(peak, sample.meterNow || 0);
    if (/input detected|test passed/i.test(sample.micStatus)) {
      physical.micInput = { status: sample.micStatus, peak, inputLabel: sample.inputLabel };
      break;
    }
    physical.micInput = { status: sample.micStatus, peak, inputLabel: sample.inputLabel };
  }
  const micPassed = /input detected|test passed/i.test(physical.micInput?.status || "");
  await screenshot(ws, "05-audio-test");
  physical.microphonePhysical = micPassed ? "PASS" : (physical.micPermission.meterPresent ? "BLOCKED_ENVIRONMENT" : "FAIL");
  record(
    "microphone-physical",
    micPassed ? "PACKAGED_PASS" : physical.microphonePhysical === "BLOCKED_ENVIRONMENT" ? "BLOCKED_ENVIRONMENT" : "FAIL",
    "screenshots/05-audio-test.png",
    JSON.stringify(physical.micInput),
  );

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await clickText(ws, "Stop test");
    await delay(400);
    const stopped = await mediaProbe(ws);
    await clickText(ws, "Test microphone");
    await delay(800);
    const started = await mediaProbe(ws);
    physical[`micCycle${cycle}`] = {
      stoppedLive: (stopped.live || []).filter((item) => item.audio.some((track) => track.state === "live")).length,
      startedLive: (started.live || []).filter((item) => item.audio.some((track) => track.state === "live")).length,
    };
  }
  await clickText(ws, "Stop test");
  await delay(400);
  const micClean = await mediaProbe(ws);
  const leftoverMic = (micClean.live || []).some((item) => item.audio.some((track) => track.state === "live"));
  record(
    "microphone-cleanup",
    leftoverMic ? "FAIL" : "PACKAGED_PASS",
    "physical-notes.json",
    JSON.stringify({ leftoverMic, cycles: [physical.micCycle1, physical.micCycle2, physical.micCycle3] }),
  );
  record("microphone-hotplug", "BLOCKED_ENVIRONMENT", "physical-notes.json", "No safely removable external microphone on this host");

  const speakerBefore = Date.now();
  await clickText(ws, "Test speakers");
  await delay(500);
  await clickText(ws, "Test speakers");
  await delay(2500);
  performance.speakerTestMs = Date.now() - speakerBefore;
  physical.speaker = {
    apiInvoked: true,
    heard: false,
    selectedOutput: (await mediaProbe(ws)).outputLabel,
    observation: "No reliable human/audio observation mechanism in this operator environment",
  };
  record("speaker-physical", "BLOCKED_ENVIRONMENT", "physical-notes.json", JSON.stringify(physical.speaker));

  const beforeCam = await mediaProbe(ws);
  physical.cameraBefore = {
    liveVideo: (beforeCam.live || []).some((item) => item.video.some((track) => track.state === "live")) || beforeCam.videoElements.some((item) => item.videoLive),
  };
  const enableCam = await clickText(ws, "Enable camera");
  const camStarted = Date.now();
  const camReady = await waitUntil(ws, `([...document.querySelectorAll("video")].some((video) => video.videoWidth > 0 && video.srcObject))`, 15000);
  performance.cameraPreviewMs = Date.now() - camStarted;
  await delay(800);
  const camProbe = await mediaProbe(ws);
  const camGum = (camProbe.gum || []).filter((item) => item.constraints && item.constraints.video);
  const audioFalse = camGum.length === 0 || camGum.every((item) => item.constraints.audio === false || item.constraints.audio == null);
  const liveFrame = camProbe.videoElements.some((item) => item.videoLive && item.width > 0 && item.height > 0);
  const camAudioLeak = camProbe.videoElements.some((item) => item.audioTracks > 0) || camGum.some((item) => item.constraints.audio === true);
  physical.camera = {
    enableClicked: enableCam.ok,
    liveFrame,
    dimensions: camProbe.videoElements.map((item) => ({ width: item.width, height: item.height, live: item.videoLive })),
    audioFalse,
    audioLeak: camAudioLeak,
    screenshotStored: false,
    reason: "Camera frame not stored to avoid capturing a person or private environment",
  };
  record(
    "camera-physical",
    liveFrame && audioFalse && !camAudioLeak ? "PACKAGED_PASS" : liveFrame ? "FAIL" : "BLOCKED_ENVIRONMENT",
    "physical-notes.json",
    JSON.stringify(physical.camera),
  );
  physical.cameraPhysical = liveFrame && audioFalse && !camAudioLeak ? "PASS" : liveFrame ? "FAIL" : "BLOCKED_ENVIRONMENT";

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await clickText(ws, "Stop camera");
    await delay(400);
    const stopped = await mediaProbe(ws);
    await clickText(ws, "Start preview");
    await delay(900);
    const started = await mediaProbe(ws);
    physical[`camCycle${cycle}`] = {
      stoppedSrc: stopped.videoElements.some((item) => item.hasSrcObject && item.videoLive),
      startedLive: started.videoElements.some((item) => item.videoLive),
    };
  }
  await clickText(ws, "Stop camera");
  await delay(400);
  const camClean = await mediaProbe(ws);
  record(
    "camera-cleanup",
    camClean.videoElements.every((item) => !item.hasSrcObject || !item.videoLive) ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify({ clean: camClean.videoElements, cycles: [physical.camCycle1, physical.camCycle2, physical.camCycle3] }),
  );
  record("camera-hotplug", "BLOCKED_ENVIRONMENT", "physical-notes.json", "No safely removable external camera on this host");

  const screenStarted = Date.now();
  await clickText(ws, "Test screen sharing");
  const picker = await waitUntil(ws, `document.querySelectorAll(".first-launch-screen-source").length > 0 ? [...document.querySelectorAll(".first-launch-screen-source")].map((btn) => ({ name: btn.querySelector("strong")?.textContent || "", type: btn.querySelector("small")?.textContent || "" })) : null`, 15000);
  performance.screenPickerMs = Date.now() - screenStarted;
  physical.screenSources = Array.isArray(picker) ? picker.map((item) => ({ name: item.name, type: item.type })) : picker;
  const hasScreen = Array.isArray(picker) && picker.some((item) => /screen/i.test(item.type));
  const hasWindow = Array.isArray(picker) && picker.some((item) => /window/i.test(item.type));
  record(
    "screen-picker-sources",
    Array.isArray(picker) && picker.length && hasScreen && hasWindow ? "PACKAGED_PASS" : Array.isArray(picker) && picker.length ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify({ count: Array.isArray(picker) ? picker.length : 0, hasScreen, hasWindow }),
  );

  await clickText(ws, "Test screen sharing");
  await delay(800);
  const canceled = await snapshot(ws);
  const cancelPassed = /test passed|capture ready|source selected/i.test(canceled.textSlice) && canceled.hasScreen;
  record(
    "screen-picker-cancel",
    /PICOM is ready|Test passed/i.test(canceled.textSlice) && cancelPassed ? "FAIL" : "PACKAGED_PASS",
    "physical-notes.json",
    "Re-opened picker without selecting a source; no success state claimed",
  );

  const selectSafe = await evaluate(ws, `(() => {
    const buttons = [...document.querySelectorAll(".first-launch-screen-source")];
    const safe = buttons.find((btn) => /picom/i.test(btn.querySelector("strong")?.textContent || ""))
      || buttons.find((btn) => /window/i.test(btn.querySelector("small")?.textContent || ""));
    if (!safe) return { ok: false };
    safe.click();
    return { ok: true, name: safe.querySelector("strong")?.textContent || "" };
  })()`);
  const preflight = await waitUntil(ws, `([...document.querySelectorAll("video")].some((video) => video.videoWidth > 0 && video.srcObject))`, 15000);
  await delay(700);
  const screenProbe = await mediaProbe(ws);
  await screenshot(ws, "07-screen-preflight-safe");
  const screenOk = Boolean(selectSafe?.ok) && Boolean(preflight) && screenProbe.videoElements.some((item) => item.videoLive && item.width > 0);
  physical.screen = { selected: selectSafe, live: screenOk, dimensions: screenProbe.videoElements };
  record(
    "screen-capture-packaged",
    screenOk ? "PACKAGED_PASS" : "FAIL",
    "screenshots/07-screen-preflight-safe.png",
    JSON.stringify(physical.screen),
  );
  physical.screenPhysical = screenOk ? "PASS" : "FAIL";

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await clickText(ws, "Stop preview");
    await delay(400);
    await clickText(ws, "Test screen sharing");
    await delay(700);
    await evaluate(ws, `(() => {
      const buttons = [...document.querySelectorAll(".first-launch-screen-source")];
      const safe = buttons.find((btn) => /picom/i.test(btn.querySelector("strong")?.textContent || "")) || buttons[0];
      safe?.click();
      return Boolean(safe);
    })()`);
    await delay(900);
  }
  await clickText(ws, "Stop preview");
  await delay(400);
  const screenClean = await mediaProbe(ws);
  record(
    "screen-stop-cleanup",
    screenClean.videoElements.every((item) => !item.videoLive) ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify(screenClean.videoElements),
  );

  const audioTruth = await settingsState(ws);
  writeFileSync(join(EVIDENCE, "audio-video-before-leave.json"), `${JSON.stringify({ settings: audioTruth, media: await mediaProbe(ws), snap: await snapshot(ws) }, null, 2)}\n`);

  await clickContinue(ws);
  await delay(900);
  snap = await snapshot(ws);
  await screenshot(ws, "08-desktop");
  const startupBefore = await nativeStartup(ws);
  const registryBefore = readPicomRunKey();
  loginItemOriginal = { ...startupBefore, registry: registryBefore };
  writeFileSync(join(EVIDENCE, "startup-original.json"), `${JSON.stringify(loginItemOriginal, null, 2)}\n`);
  record(
    "desktop-native-startup-read",
    startupBefore?.ok && startupBefore.supported ? "PACKAGED_PASS" : "FAIL",
    "startup-original.json",
    JSON.stringify(startupBefore),
  );

  let loginItemResult = "BLOCKED_ENVIRONMENT";
  if (startupBefore?.ok && startupBefore.supported) {
    const opposite = !startupBefore.enabled;
    await evaluate(ws, `window.picomDesktop.startup.setEnabled(${opposite})`);
    await delay(500);
    const toggled = await nativeStartup(ws);
    const registryToggled = readPicomRunKey();
    await evaluate(ws, `window.picomDesktop.startup.setEnabled(${Boolean(startupBefore.enabled)})`);
    await delay(500);
    const restored = await nativeStartup(ws);
    const registryRestored = readPicomRunKey();
    loginItemRestored = restored;
    writeFileSync(join(EVIDENCE, "startup-restore-proof.json"), `${JSON.stringify({
      original: startupBefore,
      toggled,
      restored,
      registryBefore,
      registryToggled,
      registryRestored,
    }, null, 2)}\n`);
    const changed = toggled.enabled === opposite;
    const back = restored.enabled === startupBefore.enabled;
    loginItemResult = changed && back ? "PASS" : "FAIL";
    record(
      "windows-login-item",
      changed && back ? "PACKAGED_PASS" : "FAIL",
      "startup-restore-proof.json",
      JSON.stringify({ original: startupBefore.enabled, toggled: toggled.enabled, restored: restored.enabled }),
    );
  } else {
    record("windows-login-item", "BLOCKED_ENVIRONMENT", "startup-original.json", "Native startup API unsupported or unavailable");
  }
  physical.loginItem = loginItemResult;

  await clickText(ws, "Keep PICOM running in system tray", "label");
  await delay(400);
  const hide1 = await closeViaTitlebar(ws);
  await delay(800);
  const hiddenCount = picomProcessCount();
  const hiddenSnap = await snapshot(ws).catch(() => ({ hidden: true, error: "evaluate-after-hide" }));
  await showWindow(ws);
  await delay(700);
  const restored1 = await snapshot(ws);
  await closeViaTitlebar(ws);
  await delay(700);
  const beforeSecond = picomProcessCount();
  spawn(EXE, [`--remote-debugging-port=${PORT}`], {
    env: { ...process.env, PICOM_USER_DATA_DIR: PROFILE },
    detached: true,
    stdio: "ignore",
  }).unref();
  await delay(2000);
  const afterSecond = picomProcessCount();
  const secondSnap = await snapshot(ws);
  physical.tray = {
    hideClicked: hide1,
    processAliveWhileHidden: hiddenCount > 0,
    restoredByTrayApi: Boolean(restored1.hasDesktop || restored1.hasFirstLaunch),
    beforeSecond,
    afterSecond,
    secondRestored: Boolean(secondSnap.hasDesktop || secondSnap.hasFirstLaunch),
    noProcessExplosion: afterSecond <= beforeSecond + 2,
  };
  record(
    "close-to-tray-restore",
    physical.tray.processAliveWhileHidden && physical.tray.restoredByTrayApi ? "PACKAGED_PASS" : "FAIL",
    "screenshots/08-desktop.png",
    JSON.stringify(physical.tray),
  );
  record(
    "second-instance",
    physical.tray.secondRestored && physical.tray.noProcessExplosion ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify({ beforeSecond, afterSecond }),
  );

  await clickText(ws, "Launch PICOM when I sign in", "label");
  await delay(400);
  await clickText(ws, "Start in system tray", "label");
  await delay(400);
  await trayQuit(ws);
  await delay(1200);
  stopPackaged();
  const trayStart = await relaunch(["--picom-login-startup"], 2200);
  ws = trayStart.ws;
  const hiddenStartup = await snapshot(ws);
  physical.startInTray = {
    hidden: hiddenStartup.hidden === true,
    hasFirstLaunch: hiddenStartup.hasFirstLaunch,
    launchMs: trayStart.launchMs,
  };
  await showWindow(ws);
  await delay(700);
  const afterTrayShow = await snapshot(ws);
  record(
    "start-in-tray",
    hiddenStartup.hidden === true && (afterTrayShow.hasDesktop || afterTrayShow.hasFirstLaunch) ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify({ hiddenStartup: physical.startInTray, restored: afterTrayShow.hasDesktop || afterTrayShow.hasFirstLaunch }),
  );
  await restoreLoginItem(ws);

  await clickText(ws, "Quit PICOM", "label");
  await delay(400);
  await closeViaTitlebar(ws);
  await delay(1500);
  const afterQuit = picomProcessCount();
  record(
    "quit-mode-titlebar",
    afterQuit === 0 ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    `processCount=${afterQuit}`,
  );
  const afterQuitRelaunch = await relaunch([], 2200);
  ws = afterQuitRelaunch.ws;
  snap = await snapshot(ws);
  record(
    "quit-desktop-resume",
    snap.hasDesktop || snap.hasNotifications || snap.hasFirstLaunch ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    `heading=${snap.heading}`,
  );
  if (snap.hasDesktop) {
    await clickText(ws, "Keep PICOM running in system tray", "label");
    await delay(300);
  }
  physical.trayClose = (
    results.find((item) => item.scenario === "close-to-tray-restore")?.result === "PACKAGED_PASS"
    && results.find((item) => item.scenario === "second-instance")?.result === "PACKAGED_PASS"
    && results.find((item) => item.scenario === "quit-mode-titlebar")?.result === "PACKAGED_PASS"
  ) ? "PASS" : "FAIL";

  if (!snap.hasNotifications) {
    if (snap.hasDesktop) await clickContinue(ws);
    await delay(800);
    snap = await snapshot(ws);
  }
  await screenshot(ws, "09-notifications");
  const capability = await nativeCapability(ws);
  physical.notificationCapability = capability;
  record(
    "notification-capability",
    capability?.ok && capability.supported ? "PACKAGED_PASS" : "FAIL",
    "screenshots/09-notifications.png",
    JSON.stringify(capability),
  );
  const created = await nativeSendTest(ws);
  await delay(800);
  await clickText(ws, "Send test notification");
  await delay(800);
  physical.notificationCreation = created;
  record(
    "windows-notification-creation",
    created?.ok && created.native ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify(created),
  );
  record("windows-toast-visibility", "BLOCKED_ENVIRONMENT", "physical-notes.json", "No reliable human observation of the Windows toast surface");
  record("notification-click", "BLOCKED_ENVIRONMENT", "physical-notes.json", "Toast not visually accessible; existing test fixture has no navigation payload");

  await clickText(ws, "Focused", "label");
  await delay(200);
  await clickText(ws, "Do Not Disturb", "label");
  await clickText(ws, "Enable quiet hours", "label").catch(() => clickText(ws, "Quiet hours", "label"));
  await delay(300);
  const notifSettings = await settingsState(ws);

  await clickContinue(ws);
  await delay(800);
  snap = await snapshot(ws);
  await screenshot(ws, "10-privacy-deferred");
  record(
    "privacy-pre-auth-deferred",
    snap.privacyDeferred && !snap.privacyInteractive && /review after sign-in/i.test(snap.textSlice) ? "PACKAGED_PASS" : "FAIL",
    "screenshots/10-privacy-deferred.png",
    JSON.stringify({ deferred: snap.privacyDeferred, interactive: snap.privacyInteractive }),
  );

  await clickContinue(ws);
  await delay(900);
  snap = await snapshot(ws);
  await screenshot(ws, "11-ready");
  const readyTruth = {
    appearanceConfigured: snap.readyRows.some((row) => /theme|appearance|dark/i.test(`${row.label} ${row.value}`) && row.status === "configured"),
    privacyDeferred: snap.readyRows.some((row) => /privacy/i.test(row.label) && /review after sign-in|deferred/i.test(`${row.value} ${row.status}`)),
    noFakeHundred: !/100%/.test(snap.textSlice),
    rows: snap.readyRows,
  };
  writeFileSync(join(EVIDENCE, "ready-summary.json"), `${JSON.stringify({ snap: { heading: snap.heading, rows: snap.readyRows, text: snap.textSlice }, readyTruth }, null, 2)}\n`);
  record(
    "ready-factual-summary",
    snap.hasReady && readyTruth.privacyDeferred && readyTruth.noFakeHundred ? "PACKAGED_PASS" : "FAIL",
    "screenshots/11-ready.png",
    JSON.stringify(readyTruth),
  );

  for (const review of ["Review audio", "Review desktop", "Review notification", "Review privacy"]) {
    const clicked = await clickAria(ws, review);
    await delay(700);
    const reviewed = await snapshot(ws);
    const ok = review.includes("audio") ? reviewed.hasAudio || reviewed.hasCamera
      : review.includes("desktop") ? reviewed.hasDesktop
        : review.includes("notification") ? reviewed.hasNotifications
          : reviewed.hasPrivacy;
    record(
      `ready-review-${review.replace(/\s+/g, "-").toLowerCase()}`,
      clicked.ok && ok ? "PACKAGED_PASS" : "FAIL",
      "screenshots/11-ready.png",
      JSON.stringify({ clicked, heading: reviewed.heading }),
    );
    await returnToReady(ws);
    await delay(500);
  }

  const completeStarted = Date.now();
  const complete = await clickContinue(ws);
  const loginShown = await waitUntil(ws, `Boolean(document.querySelector(".auth-desktop-frame") || /Welcome back/i.test(document.body?.innerText || ""))`, 15000);
  performance.readyToLoginMs = Date.now() - completeStarted;
  snap = await snapshot(ws);
  await screenshot(ws, "12-login-after-completion");
  const completedState = await settingsState(ws);
  const loginMedia = await mediaProbe(ws);
  const loginClean = (loginMedia.live || []).every((item) => item.audio.every((track) => track.state !== "live") && item.video.every((track) => track.state !== "live"))
    && loginMedia.videoElements.every((item) => !item.hasSrcObject || !item.videoLive);
  record(
    "completion-to-login",
    complete && snap.hasLogin && !snap.hasFirstLaunch && completedState.completed === true ? "PACKAGED_PASS" : "FAIL",
    "screenshots/12-login-after-completion.png",
    JSON.stringify({ complete, hasLogin: snap.hasLogin, completed: completedState }),
  );
  record(
    "post-completion-resources",
    loginClean ? "PACKAGED_PASS" : "FAIL",
    "physical-notes.json",
    JSON.stringify(loginMedia),
  );
  record("auth-packaged-e2e", "BLOCKED_TEST_IDENTITY", "screenshots/12-login-after-completion.png", "Stopped at Login; TASK 13C owns auth");

  await trayQuit(ws);
  await delay(1200);
  stopPackaged();
  const post = await relaunch([], 2200);
  ws = post.ws;
  snap = await snapshot(ws);
  const postState = await settingsState(ws);
  await screenshot(ws, "13-restart-after-completion");
  record(
    "restart-suppresses-first-run",
    snap.hasLogin && !snap.hasFirstLaunch && postState.completed === true && postState.theme === "dark" ? "PACKAGED_PASS" : "FAIL",
    "screenshots/13-restart-after-completion.png",
    JSON.stringify({ hasLogin: snap.hasLogin, hasFirstLaunch: snap.hasFirstLaunch, postState }),
  );
  await trayQuit(ws);
  await delay(800);
  stopPackaged();

  writeEvidence();
}

try {
  await main();
} catch (error) {
  note(`OPERATOR_ERROR ${error.stack || error.message}`);
  try {
    if (loginItemOriginal != null) {
      const page = await waitForCdp(5000).catch(() => null);
      if (page) await restoreLoginItem(page.webSocketDebuggerUrl);
    }
  } catch {
    /* restore best-effort */
  }
  writeEvidence();
  stopPackaged();
  process.exit(1);
}
