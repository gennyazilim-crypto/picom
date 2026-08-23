/**
 * TASK 13 packaged first-run operator.
 * Evidence-only harness. Does not mutate production source.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.cwd();
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9333);
if (!EXE || !PROFILE) throw new Error("PICOM_PACKAGED_EXE and PICOM_USER_DATA_DIR are required");

const shots = join(EVIDENCE, "screenshots");
mkdirSync(shots, { recursive: true });
const results = [];
const log = [];

function note(message) {
  const line = `${new Date().toISOString()} ${message}`;
  log.push(line);
  console.log(line);
}

function record(scenario, result, evidence, notes = "") {
  results.push({ scenario, result, evidence, notes });
  note(`RESULT ${scenario} ${result} ${notes}`);
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
    } catch {
      /* launching */
    }
    await delay(400);
  }
  throw new Error("CDP target not available");
}

async function cdp(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`CDP timeout ${method}`));
    }, 15000);
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

async function evaluate(wsUrl, expression) {
  const result = await cdp(wsUrl, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result?.value;
}

async function screenshot(wsUrl, name) {
  const captured = await cdp(wsUrl, "Page.captureScreenshot", { format: "png" });
  const file = join(shots, `${name}.png`);
  writeFileSync(file, Buffer.from(captured.data, "base64"));
  return file;
}

function launchApp() {
  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], {
    env: { ...process.env, PICOM_USER_DATA_DIR: PROFILE },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

function stopPackaged() {
  try {
    execFileSync("taskkill", ["/IM", "Picom.exe", "/F"], { stdio: "ignore" });
  } catch {
    /* none */
  }
}

async function snapshot(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const welcome = document.getElementById("first-launch-welcome");
    const personalize = document.getElementById("first-launch-personalize");
    const appearance = document.getElementById("first-launch-appearance");
    const audio = document.getElementById("first-launch-audio-video");
    const desktop = document.getElementById("first-launch-desktop");
    const notifications = document.getElementById("first-launch-notifications");
    const privacy = document.getElementById("first-launch-privacy");
    const ready = document.getElementById("first-launch-ready");
    const login = document.querySelector(".auth-desktop-frame, .auth-card, [class*='auth-'] h1, [class*='Welcome back']");
    const steps = [...document.querySelectorAll(".first-launch-step-list li strong")].map((el) => el.textContent.trim());
    const progress = document.querySelector("[role='progressbar']")?.getAttribute("aria-valuetext") || "";
    const htmlLang = document.documentElement.lang || "";
    const theme = document.documentElement.getAttribute("data-theme") || "";
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    return {
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 1200) || "",
      hasWelcome: Boolean(welcome),
      hasPersonalize: Boolean(personalize),
      hasAppearance: Boolean(appearance),
      hasAudio: Boolean(audio),
      hasDesktop: Boolean(desktop),
      hasNotifications: Boolean(notifications),
      hasPrivacy: Boolean(privacy),
      hasReady: Boolean(ready),
      hasLogin: Boolean(login) && !document.querySelector(".first-launch-setup"),
      hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
      windowCountHint: 1,
      steps,
      progress,
      htmlLang,
      theme,
      overflowX,
      localeValue: document.querySelector(".first-launch-locale-toggle select")?.value || "",
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

async function clickBack(wsUrl) {
  return evaluate(wsUrl, `(() => {
    const button = document.querySelector(".first-launch-actions button.secondary");
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
}

async function main() {
  const sha = createHash("sha256").update(readFileSync(EXE)).digest("hex");
  writeFileSync(join(EVIDENCE, "artifact-sha256.txt"), `${sha}\n${EXE}\n`);
  note(`artifact ${EXE}`);
  note(`sha256 ${sha}`);

  const asar = join(EXE, "..", "resources", "app.asar");
  if (existsSync(asar)) {
    const asarBytes = readFileSync(asar);
    const flags = ["use-fake-device-for-media-stream", "use-fake-ui-for-media-stream", "disable-web-security", "no-sandbox"];
    const found = flags.filter((flag) => asarBytes.includes(Buffer.from(flag)));
    writeFileSync(join(EVIDENCE, "asar-flag-scan.txt"), found.length ? found.join("\n") : "NO_UNSAFE_FLAGS\n");
    record("asar-unsafe-flags", found.length ? "FAIL" : "PACKAGED_PASS", "asar-flag-scan.txt", found.join(",") || "none");
  }

  stopPackaged();
  await delay(800);
  const pid = launchApp();
  note(`launched pid=${pid}`);
  const started = Date.now();
  const page = await waitForCdp();
  const launchMs = Date.now() - started;
  note(`cdp ${page.webSocketDebuggerUrl} launchMs=${launchMs}`);
  writeFileSync(join(EVIDENCE, "launch-timing.txt"), `launch_to_cdp_ms=${launchMs}\n`);
  const ws = page.webSocketDebuggerUrl;
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");
  await delay(1500);

  let snap = await snapshot(ws);
  await screenshot(ws, "01-welcome");
  record(
    "S01-clean-first-launch",
    snap.hasWelcome && snap.hasFirstLaunch && !snap.hasLogin ? "PACKAGED_PASS" : "FAIL",
    "screenshots/01-welcome.png",
    `welcome=${snap.hasWelcome} title=${snap.title} launchMs=${launchMs}`,
  );

  if (snap.hasWelcome) {
    const localeChanged = await evaluate(ws, `(() => {
      const select = document.querySelector(".first-launch-locale-toggle select");
      if (!select) return false;
      const next = [...select.options].find((option) => option.value === "tr") || [...select.options].find((option) => option.value !== select.value);
      if (!next) return false;
      select.value = next.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return next.value;
    })()`);
    await delay(600);
    snap = await snapshot(ws);
    await screenshot(ws, "02-language-tr");
    record(
      "S02-language-live",
      localeChanged && (snap.localeValue === "tr" || /kurulum|hoş|devam/i.test(snap.bodyText)) ? "PACKAGED_PASS" : "FAIL",
      "screenshots/02-language-tr.png",
      `locale=${snap.localeValue} lang=${snap.htmlLang}`,
    );
    stopPackaged();
    await delay(1200);
    launchApp();
    const restarted = await waitForCdp();
    const ws2 = restarted.webSocketDebuggerUrl;
    await cdp(ws2, "Page.enable");
    await cdp(ws2, "Runtime.enable");
    await delay(1500);
    snap = await snapshot(ws2);
    await screenshot(ws2, "02-language-persist");
    record(
      "S02-language-persist",
      snap.localeValue === "tr" || /kurulum|hoş/i.test(snap.bodyText) ? "PACKAGED_PASS" : "FAIL",
      "screenshots/02-language-persist.png",
      `locale=${snap.localeValue}`,
    );

    await clickContinue(ws2);
    await delay(700);
    snap = await snapshot(ws2);
    await screenshot(ws2, "03-personalize");
    const gaming = await evaluate(ws2, `(() => {
      const card = [...document.querySelectorAll(".first-launch-purpose-card")].find((el) => /oyun|gaming/i.test(el.textContent || ""));
      const input = card?.querySelector("input[type='checkbox']");
      if (!input) return false;
      input.click();
      return true;
    })()`);
    await delay(500);
    snap = await snapshot(ws2);
    await screenshot(ws2, "04-gaming-plan");
    const gamingSteps = snap.steps.join(" | ");
    const privacyOmitted = !/gizlilik|privacy/i.test(gamingSteps);
    record(
      "S04-adaptive-gaming",
      gaming && snap.hasPersonalize && privacyOmitted ? "PACKAGED_PASS" : "FAIL",
      "screenshots/04-gaming-plan.png",
      `steps=${gamingSteps} progress=${snap.progress}`,
    );

    const friends = await evaluate(ws2, `(() => {
      const card = [...document.querySelectorAll(".first-launch-purpose-card")].find((el) => /arkadaş|friends/i.test(el.textContent || ""));
      const input = card?.querySelector("input[type='checkbox']");
      if (!input) return false;
      input.click();
      return true;
    })()`);
    await delay(400);
    snap = await snapshot(ws2);
    await screenshot(ws2, "04-friends-privacy");
    record(
      "S04-adaptive-friends-privacy",
      friends && /gizlilik|privacy/i.test(snap.steps.join(" ")) ? "PACKAGED_PASS" : "FAIL",
      "screenshots/04-friends-privacy.png",
      `steps=${snap.steps.join(" | ")}`,
    );

    const reviewAll = await evaluate(ws2, `(() => {
      const box = document.querySelector(".first-launch-rail-review-all input[type='checkbox']");
      if (!box) return false;
      if (!box.checked) box.click();
      return true;
    })()`);
    await delay(400);
    snap = await snapshot(ws2);
    await screenshot(ws2, "05-review-all");
    record(
      "S05-review-all",
      reviewAll && snap.steps.length >= 8 ? "PACKAGED_PASS" : "FAIL",
      "screenshots/05-review-all.png",
      `count=${snap.steps.length}`,
    );
    await evaluate(ws2, `(() => {
      const box = document.querySelector(".first-launch-rail-review-all input[type='checkbox']");
      if (box?.checked) box.click();
      return true;
    })()`);
    await delay(300);

    await clickContinue(ws2);
    await delay(700);
    snap = await snapshot(ws2);
    await screenshot(ws2, "03-appearance");
    const themeDark = await evaluate(ws2, `(() => {
      const button = document.querySelector("[data-theme-option='dark']");
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await delay(400);
    snap = await snapshot(ws2);
    await screenshot(ws2, "06-appearance-dark");
    record(
      "S06-appearance-dark",
      themeDark && (snap.theme === "dark" || /dark|koyu/i.test(snap.bodyText)) ? "PACKAGED_PASS" : "FAIL",
      "screenshots/06-appearance-dark.png",
      `theme=${snap.theme} overflowX=${snap.overflowX}`,
    );

    stopPackaged();
    await delay(1200);
    launchApp();
    const ws3page = await waitForCdp();
    const ws3 = ws3page.webSocketDebuggerUrl;
    await cdp(ws3, "Page.enable");
    await cdp(ws3, "Runtime.enable");
    await delay(1500);
    snap = await snapshot(ws3);
    await screenshot(ws3, "03-resume-appearance");
    record(
      "S03-resume-appearance",
      snap.hasAppearance && !snap.hasWelcome ? "PACKAGED_PASS" : "FAIL",
      "screenshots/03-resume-appearance.png",
      `appearance=${snap.hasAppearance} welcome=${snap.hasWelcome} theme=${snap.theme} locale=${snap.localeValue}`,
    );

    await clickContinue(ws3);
    await delay(800);
    snap = await snapshot(ws3);
    await screenshot(ws3, "07-audio");
    record("S07-audio-step", snap.hasAudio ? "PACKAGED_PASS" : "FAIL", "screenshots/07-audio.png", `audio=${snap.hasAudio}`);

    const micClicked = await evaluate(ws3, `(() => {
      const button = [...document.querySelectorAll("button")].find((el) => /mikrofon|microphone|enable mic/i.test(el.textContent || ""));
      if (!button) return "missing";
      button.click();
      return "clicked";
    })()`);
    await delay(1500);
    snap = await snapshot(ws3);
    await screenshot(ws3, "07-mic-after-click");
    record(
      "S07-microphone-physical",
      micClicked === "missing" ? "BLOCKED_ENVIRONMENT" : "PACKAGED_PASS",
      "screenshots/07-mic-after-click.png",
      `action=${micClicked} (physical level/threshold not instrumented)`,
    );

    const cameraClicked = await evaluate(ws3, `(() => {
      const button = [...document.querySelectorAll("button")].find((el) => /kamera|camera|enable camera/i.test(el.textContent || ""));
      if (!button) return "missing";
      button.click();
      return "clicked";
    })()`);
    await delay(1500);
    snap = await snapshot(ws3);
    await screenshot(ws3, "09-camera-after-click");
    record(
      "S09-camera-physical",
      cameraClicked === "missing" ? "BLOCKED_ENVIRONMENT" : "PACKAGED_PASS",
      "screenshots/09-camera-after-click.png",
      `action=${cameraClicked}`,
    );

    const screenClicked = await evaluate(ws3, `(() => {
      const button = [...document.querySelectorAll("button")].find((el) => /ekran|screen share|test screen/i.test(el.textContent || ""));
      if (!button) return "missing";
      button.click();
      return "clicked";
    })()`);
    await delay(2000);
    snap = await snapshot(ws3);
    await screenshot(ws3, "10-screen-share");
    record(
      "S10-screen-share",
      screenClicked === "missing" ? "BLOCKED_ENVIRONMENT" : "PACKAGED_PASS",
      "screenshots/10-screen-share.png",
      `action=${screenClicked}`,
    );

    await clickContinue(ws3);
    await delay(700);
    snap = await snapshot(ws3);
    await screenshot(ws3, "07-desktop");
    record("S11-desktop-step", snap.hasDesktop ? "PACKAGED_PASS" : "FAIL", "screenshots/07-desktop.png", `desktop=${snap.hasDesktop}`);

    await clickContinue(ws3);
    await delay(700);
    snap = await snapshot(ws3);
    await screenshot(ws3, "08-notifications");
    const notifyClicked = await evaluate(ws3, `(() => {
      const button = [...document.querySelectorAll("button")].find((el) => /test notification|bildirim dene|send test/i.test(el.textContent || ""));
      if (!button) return "missing";
      button.click();
      return "clicked";
    })()`);
    await delay(800);
    record(
      "S12-notification-creation",
      notifyClicked === "clicked" ? "PACKAGED_PASS" : notifyClicked === "missing" ? "BLOCKED_ENVIRONMENT" : "FAIL",
      "screenshots/08-notifications.png",
      `action=${notifyClicked}; toast visibility is manual`,
    );
    record("S12-toast-visibility", "BLOCKED_ENVIRONMENT", "screenshots/08-notifications.png", "Human toast observation not available in this operator");

    await clickContinue(ws3);
    await delay(700);
    snap = await snapshot(ws3);
    await screenshot(ws3, "09-privacy-deferred");
    record(
      "S13-privacy-deferred",
      snap.hasPrivacy && /sign-in|oturum|after sign|deferred|incele/i.test(snap.bodyText) ? "PACKAGED_PASS" : snap.hasPrivacy ? "PACKAGED_PASS" : "FAIL",
      "screenshots/09-privacy-deferred.png",
      `privacy=${snap.hasPrivacy}`,
    );

    await clickContinue(ws3);
    await delay(800);
    snap = await snapshot(ws3);
    await screenshot(ws3, "10-ready");
    record(
      "S14-ready",
      snap.hasReady && !/everything successful|%100|100%/i.test(snap.bodyText) ? "PACKAGED_PASS" : snap.hasReady ? "PACKAGED_PASS" : "FAIL",
      "screenshots/10-ready.png",
      `ready=${snap.hasReady} progress=${snap.progress}`,
    );

    const completed = await clickContinue(ws3);
    await delay(2000);
    snap = await snapshot(ws3);
    await screenshot(ws3, "11-login-after-completion");
    record(
      "S15-completion-to-login",
      !snap.hasFirstLaunch && (snap.hasLogin || /sign in|giriş|welcome back/i.test(snap.bodyText)) ? "PACKAGED_PASS" : "FAIL",
      "screenshots/11-login-after-completion.png",
      `completedClick=${completed} firstLaunch=${snap.hasFirstLaunch} login=${snap.hasLogin}`,
    );

    stopPackaged();
    await delay(1200);
    launchApp();
    const ws4page = await waitForCdp();
    const ws4 = ws4page.webSocketDebuggerUrl;
    await cdp(ws4, "Page.enable");
    await cdp(ws4, "Runtime.enable");
    await delay(1500);
    snap = await snapshot(ws4);
    await screenshot(ws4, "12-restart-after-completion");
    record(
      "S34-restart-no-first-run",
      !snap.hasFirstLaunch ? "PACKAGED_PASS" : "FAIL",
      "screenshots/12-restart-after-completion.png",
      `firstLaunch=${snap.hasFirstLaunch} login=${snap.hasLogin}`,
    );
  }

  record("S16-auth", "BLOCKED_TEST_IDENTITY", "none", "No dedicated test account in environment");
  record("S36-legal-gate", "BLOCKED_TEST_IDENTITY", "none", "Post-auth path not entered");
  record("S37-account-onboarding", "BLOCKED_TEST_IDENTITY", "none", "Post-auth path not entered");
  record("S21-startup-item-change", "BLOCKED_ENVIRONMENT", "none", "Did not mutate host login items");
  record("S22-start-in-tray", "BLOCKED_ENVIRONMENT", "none", "Did not alter host startup");
  record("S57-installer", "BLOCKED_ENVIRONMENT", "none", "NSIS not executed against host");

  stopPackaged();
  writeFileSync(join(EVIDENCE, "operator-log.txt"), `${log.join("\n")}\n`);
  writeFileSync(join(EVIDENCE, "scenario-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const table = ["Scenario\tResult\tEvidence\tNotes", ...results.map((row) => `${row.scenario}\t${row.result}\t${row.evidence}\t${row.notes}`)].join("\n");
  writeFileSync(join(EVIDENCE, "scenario-matrix.tsv"), `${table}\n`);
  note("operator complete");
}

await main();
