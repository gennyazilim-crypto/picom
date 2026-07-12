const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const RESULT_PREFIX = "PICOM_HOSTED_E2E_RESULT=";
const windows = new Map();
const configsByWebContents = new Map();
const pending = new Map();
const readyWaiters = new Map();
let commandSequence = 0;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const safeError = (error) => String(error instanceof Error ? error.message : error).replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]").replace(/(?:https?|wss):\/\/\S+/g, "[redacted-url]").slice(0, 300);

function readConfig() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const input = process.env.PICOM_HOSTED_E2E_CONFIG_FD === "3" ? new fs.ReadStream(null, { fd: 3, autoClose: true }) : process.stdin;
    delete process.env.PICOM_HOSTED_E2E_CONFIG_FD;
    input.setEncoding("utf8");
    input.on("data", (chunk) => chunks.push(chunk));
    input.on("end", () => {
      try { resolve(JSON.parse(chunks.join(""))); } catch { reject(new Error("Hosted harness configuration is invalid.")); }
    });
    input.on("error", reject);
  });
}

ipcMain.handle("picom-hosted-media:get-config", (event) => {
  const config = configsByWebContents.get(event.sender.id);
  if (!config) throw new Error("Hosted client configuration is unavailable.");
  return config;
});

ipcMain.on("picom-hosted-media:result", (event, result) => {
  if (!result || typeof result.commandId !== "string") return;
  if (result.commandId === "ready") {
    readyWaiters.get(event.sender.id)?.();
    readyWaiters.delete(event.sender.id);
    return;
  }
  const key = `${event.sender.id}:${result.commandId}`;
  const waiter = pending.get(key);
  if (!waiter) return;
  clearTimeout(waiter.timer);
  pending.delete(key);
  if (result.ok) waiter.resolve(result.data ?? null);
  else waiter.reject(new Error(result.error || "Hosted renderer command failed."));
});

async function createClientWindow(config, rendererHtml, preloadPath) {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      partition: `picom-hosted-e2e-${config.label}-${Date.now()}`,
    },
  });
  window.webContents.setAudioMuted(true);
  configsByWebContents.set(window.webContents.id, config);
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${config.label} renderer did not become ready.`)), 20000);
    readyWaiters.set(window.webContents.id, () => { clearTimeout(timer); resolve(); });
  });
  windows.set(config.label, window);
  await window.loadFile(rendererHtml);
  await ready;
  return window;
}

function sendCommand(label, type, payload = null, timeoutMs = 60000) {
  const window = windows.get(label);
  if (!window || window.isDestroyed()) return Promise.reject(new Error(`${label} window is unavailable.`));
  commandSequence += 1;
  const commandId = `${type}-${commandSequence}`;
  return new Promise((resolve, reject) => {
    const key = `${window.webContents.id}:${commandId}`;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`${label} ${type} timed out.`)); }, timeoutMs);
    pending.set(key, { resolve, reject, timer });
    window.webContents.send("picom-hosted-media:command", { id: commandId, type, payload });
  });
}

async function runMatrix(config) {
  const labels = config.clients.map((client) => client.label);
  await Promise.all(config.clients.map((client) => createClientWindow(client, config.rendererHtml, config.preloadPath)));
  const connected = await Promise.all(labels.map((label) => sendCommand(label, "connect")));
  const published = await Promise.all(labels.map((label) => sendCommand(label, "publish")));
  const media = await Promise.all(labels.map((label) => sendCommand(label, "verify-media", null, 90000)));
  for (const label of labels) await sendCommand(label, "mute-cycle");
  const controls = await Promise.all(labels.map((label) => sendCommand(label, "verify-controls", null, 30000)));

  let reconnect;
  try {
    reconnect = await sendCommand("member", "simulate-reconnect", null, 50000);
  } catch {
    const memberWindow = windows.get("member");
    if (!memberWindow) throw new Error("Member reconnect client is unavailable.");
    memberWindow.webContents.session.enableNetworkEmulation({ offline: true });
    await delay(5000);
    memberWindow.webContents.session.disableNetworkEmulation();
    reconnect = await sendCommand("member", "wait-reconnected", null, 60000);
  }

  const postReconnectMedia = await sendCommand("member", "verify-media", null, 90000);

  const cleanup = await Promise.all(labels.map((label) => sendCommand(label, "cleanup", null, 30000)));
  return { connected, published, media, controls, reconnect, postReconnectMedia, cleanup };
}

void (async () => {
  let result;
  try {
    const config = await readConfig();
    if (!Array.isArray(config.clients) || config.clients.length < 2) throw new Error("At least two hosted clients are required.");
    await app.whenReady();
    result = { status: "passed", matrix: await runMatrix(config) };
  } catch (error) {
    result = { status: "failed", error: safeError(error) };
    process.exitCode = 1;
  } finally {
    process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`);
    for (const window of windows.values()) if (!window.isDestroyed()) window.destroy();
    windows.clear();
    configsByWebContents.clear();
    setTimeout(() => app.quit(), 50);
  }
})();
