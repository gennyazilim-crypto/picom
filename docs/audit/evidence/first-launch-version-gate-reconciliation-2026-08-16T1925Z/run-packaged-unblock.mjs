/**
 * TASK 13A packaged version-gate + first-run unblock operator.
 * Evidence-only. Does not mutate production source.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EVIDENCE = process.cwd();
const EXE = process.env.PICOM_PACKAGED_EXE;
const PROFILE = process.env.PICOM_USER_DATA_DIR;
const PORT = Number(process.env.PICOM_CDP_PORT || 9334);
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
    const welcome = document.getElementById("first-launch-welcome-heading");
    const personalize = document.getElementById("first-launch-personalize-heading");
    const appearance = document.getElementById("first-launch-appearance-heading");
    const gate = document.querySelector("[data-version-gate='required']");
    const continueBtn = [...document.querySelectorAll(".first-launch-actions button.primary")].at(-1);
    return {
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 800) || "",
      hasWelcome: Boolean(welcome),
      hasPersonalize: Boolean(personalize),
      hasAppearance: Boolean(appearance),
      hasBlockingGate: Boolean(gate),
      continueEnabled: Boolean(continueBtn) && !continueBtn.disabled,
      hasFirstLaunch: Boolean(document.querySelector(".first-launch-setup")),
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

async function main() {
  const sha = createHash("sha256").update(readFileSync(EXE)).digest("hex");
  writeFileSync(join(EVIDENCE, "artifact-sha256.txt"), `${sha}\n${EXE}\n`);
  note(`artifact ${EXE}`);
  note(`sha256 ${sha}`);

  stopPackaged();
  await delay(800);
  const pid = launchApp();
  note(`launched pid=${pid}`);
  const started = Date.now();
  const page = await waitForCdp();
  const launchMs = Date.now() - started;
  note(`cdp ${page.webSocketDebuggerUrl} launchMs=${launchMs}`);
  const ws = page.webSocketDebuggerUrl;
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");
  await delay(2500);

  let snap = await snapshot(ws);
  await screenshot(ws, "01-welcome-unblocked");
  const policy = await evaluate(ws, `(() => {
    const gate = document.querySelector("[data-version-gate]");
    return {
      gate: gate?.getAttribute("data-version-gate") || null,
      remoteHint: /update required|minimum/i.test(document.body?.innerText || ""),
    };
  })()`);
  record(
    "version-gate",
    !snap.hasBlockingGate ? "PACKAGED_PASS" : "FAIL",
    "screenshots/01-welcome-unblocked.png",
    JSON.stringify(policy),
  );
  record(
    "welcome-interactive",
    snap.hasWelcome && snap.continueEnabled && !snap.hasBlockingGate ? "PACKAGED_PASS" : "FAIL",
    "screenshots/01-welcome-unblocked.png",
    `welcome=${snap.hasWelcome} continue=${snap.continueEnabled}`,
  );

  const nextOk = await clickContinue(ws);
  await delay(800);
  snap = await snapshot(ws);
  await screenshot(ws, "02-personalize");
  record(
    "personalize-reachable",
    nextOk && snap.hasPersonalize && !snap.hasBlockingGate ? "PACKAGED_PASS" : "FAIL",
    "screenshots/02-personalize.png",
    `next=${nextOk} personalize=${snap.hasPersonalize}`,
  );

  const appearanceOk = await clickContinue(ws);
  await delay(800);
  snap = await snapshot(ws);
  await screenshot(ws, "03-appearance");
  record(
    "appearance-reachable",
    appearanceOk && snap.hasAppearance && !snap.hasBlockingGate ? "PACKAGED_PASS" : "FAIL",
    "screenshots/03-appearance.png",
    `next=${appearanceOk} appearance=${snap.hasAppearance}`,
  );

  writeFileSync(join(EVIDENCE, "operator-log.txt"), `${log.join("\n")}\n`);
  writeFileSync(join(EVIDENCE, "scenario-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, "launch-timing.txt"), `launch_to_cdp_ms=${launchMs}\n`);
  stopPackaged();
  const failed = results.some((item) => item.result === "FAIL");
  if (failed) process.exit(1);
}

await main();
