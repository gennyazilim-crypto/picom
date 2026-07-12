const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const RESULT_PREFIX = "PICOM_HOSTED_E2E_RESULT=";
const windows = new Map();
const configsByWebContents = new Map();
const pending = new Map();
const readyWaiters = new Map();
const captureSessions = new Map();
let commandSequence = 0;
let shareTargetWindow = null;

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

ipcMain.handle("picom-hosted-media:get-screen-sources", async (event) => {
  const config = configsByWebContents.get(event.sender.id);
  if (!config?.nativeCapture) return { ok: false, error: "NATIVE_CAPTURE_NOT_ENABLED" };
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
  const safeSources = sources.map((source) => Object.freeze({ id: source.id, name: source.name.slice(0, 120), type: source.id.startsWith("screen:") ? "screen" : "window" }));
  const requestId = `native-${event.sender.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  captureSessions.set(event.sender.id, { requestId, expiresAt: Date.now() + 30000, sources: safeSources });
  return { ok: true, requestId, sources: safeSources };
});

ipcMain.handle("picom-hosted-media:cancel-screen-selection", (event, payload) => {
  const session = captureSessions.get(event.sender.id);
  if (!session || payload?.requestId !== session.requestId) return { ok: false, error: "SCREEN_SELECTION_UNAVAILABLE" };
  captureSessions.delete(event.sender.id);
  return { ok: true, canceled: true };
});

ipcMain.handle("picom-hosted-media:select-screen-source", (event, payload) => {
  const session = captureSessions.get(event.sender.id);
  if (!session || session.expiresAt < Date.now() || payload?.requestId !== session.requestId) {
    captureSessions.delete(event.sender.id);
    return { ok: false, error: "SCREEN_SELECTION_EXPIRED" };
  }
  const source = session.sources.find((candidate) => candidate.id === payload?.sourceId);
  captureSessions.delete(event.sender.id);
  return source ? { ok: true, source } : { ok: false, error: "SCREEN_SOURCE_UNAVAILABLE" };
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
  window.webContents.session.setPermissionCheckHandler((_webContents, permission) => permission === "media");
  window.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
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
  const rendererHtml = app.isPackaged ? path.join(__dirname, "index.html") : config.rendererHtml;
  const preloadPath = app.isPackaged ? path.join(__dirname, "preload.cjs") : config.preloadPath;
  if (config.nativeCapture) {
    shareTargetWindow = new BrowserWindow({ width: 720, height: 420, show: false, title: "Picom Certification Share Target", webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    await shareTargetWindow.loadURL("data:text/html,<title>Picom Certification Share Target</title><body style='margin:0;background:%2317353a;color:white;display:grid;place-items:center;font:32px sans-serif'>Picom native screen-share target</body>");
    shareTargetWindow.setAlwaysOnTop(true, "screen-saver");
    shareTargetWindow.show();
    shareTargetWindow.focus();
    await delay(750);
  }
  const labels = config.clients.map((client) => client.label);
  await Promise.all(config.clients.map((client) => createClientWindow({ ...client, nativeCapture: Boolean(config.nativeCapture) }, rendererHtml, preloadPath)));
  const connected = await Promise.all(labels.map((label) => sendCommand(label, "connect")));
  const published = await Promise.all(labels.map((label) => sendCommand(label, "publish")));
  const media = await Promise.all(labels.map((label) => sendCommand(label, "verify-media", null, 90000)));
  for (const label of labels) await sendCommand(label, "mute-cycle");
  const controls = await Promise.all(labels.map((label) => sendCommand(label, "verify-controls", null, 30000)));
  const screenRestart = config.nativeCapture ? await sendCommand("member", "screen-restart", null, 60000) : null;
  const postRestartMedia = config.nativeCapture ? await Promise.all(labels.map((label) => sendCommand(label, "verify-media", null, 90000))) : null;

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
  return { connected, published, media, controls, screenRestart, postRestartMedia, reconnect, postReconnectMedia, cleanup };
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
    if (shareTargetWindow && !shareTargetWindow.isDestroyed()) shareTargetWindow.destroy();
    shareTargetWindow = null;
    windows.clear();
    configsByWebContents.clear();
    captureSessions.clear();
    setTimeout(() => app.quit(), 50);
  }
})();
