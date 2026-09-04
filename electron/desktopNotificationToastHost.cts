import { BrowserWindow, screen, type IpcMainInvokeEvent } from "electron";

export type DesktopNotificationToastAction = "open" | "dismiss" | "accept" | "decline" | "message" | "watch-live";

export type DesktopNotificationToastPayload = Readonly<{
  notificationId: string;
  type: "friend-request" | "friend-accepted" | "dm" | "friend-online" | "live";
  title: string;
  body: string;
  closeLabel: string;
  soundEnabled: boolean;
  accent: "indigo" | "teal" | "rose";
  primaryAction?: Readonly<{ action: Exclude<DesktopNotificationToastAction, "dismiss">; label: string }>;
  secondaryAction?: Readonly<{ action: Exclude<DesktopNotificationToastAction, "dismiss">; label: string }>;
}>;

const TOAST_WIDTH = 404;
const TOAST_MARGIN = 20;
const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_LIFETIME_MS = 7_000;

let toastWindow: BrowserWindow | null = null;
let queue: DesktopNotificationToastPayload[] = [];
let activeToasts: DesktopNotificationToastPayload[] = [];
let actionHandler: ((action: DesktopNotificationToastAction, notificationId: string) => void) | null = null;
let displayEventsRegistered = false;
let playSoundAfterRender = false;
let lastSoundAt = 0;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeText(value: string, limit: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
}

function resolveDisplay(): Electron.Display {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed() && focused !== toastWindow) {
    return screen.getDisplayMatching(focused.getBounds());
  }
  const main = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed() && candidate !== toastWindow && candidate.isVisible());
  return main ? screen.getDisplayMatching(main.getBounds()) : screen.getPrimaryDisplay();
}

function positionToastHost(window: BrowserWindow): void {
  const display = resolveDisplay();
  const { x, y, width, height } = display.workArea;
  const bounds = window.getBounds();
  window.setPosition(Math.round(x + width - bounds.width - TOAST_MARGIN), Math.round(y + height - bounds.height - TOAST_MARGIN));
}

function toastCard(payload: DesktopNotificationToastPayload): string {
  const primary = payload.primaryAction
    ? `<button class="action action-primary" data-action="${payload.primaryAction.action}" data-id="${escapeHtml(payload.notificationId)}">${escapeHtml(payload.primaryAction.label)}</button>`
    : "";
  const secondary = payload.secondaryAction
    ? `<button class="action action-secondary" data-action="${payload.secondaryAction.action}" data-id="${escapeHtml(payload.notificationId)}">${escapeHtml(payload.secondaryAction.label)}</button>`
    : "";
  return `<article class="toast toast-${payload.accent}" data-toast="${escapeHtml(payload.notificationId)}" role="status" aria-live="polite">
    <span class="accent" aria-hidden="true"></span>
    <div class="mark" aria-hidden="true">P</div>
    <div class="copy"><strong>${escapeHtml(payload.title)}</strong><p>${escapeHtml(payload.body)}</p>${primary || secondary ? `<div class="actions">${primary}${secondary}</div>` : ""}</div>
    <button class="close" data-action="dismiss" data-id="${escapeHtml(payload.notificationId)}" aria-label="${escapeHtml(payload.closeLabel)}" title="${escapeHtml(payload.closeLabel)}">×</button>
  </article>`;
}

function buildHtml(payloads: readonly DesktopNotificationToastPayload[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<title>PICOM notifications</title><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden;font-family:Manrope,"Segoe UI",system-ui,sans-serif}.stack{height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:2px}.toast{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr) 26px;gap:12px;min-height:92px;padding:16px 12px 15px 16px;border:1px solid rgba(151,166,202,.2);border-radius:12px;background:#171a21;color:#f7f8fc;box-shadow:0 18px 44px rgba(0,0,0,.34);overflow:hidden;animation:enter 210ms ease-out}.accent{position:absolute;inset:0 auto 0 0;width:3px;background:#5b6cff}.toast-teal .accent{background:#19c5b8}.toast-rose .accent{background:#fa647b}.mark{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#252b3a;color:#fff;font-size:15px;font-weight:800}.copy{min-width:0;padding-top:1px}.copy strong{display:block;font-size:13px;line-height:1.35;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.copy p{margin:4px 0 0;color:#bdc3d2;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.close{align-self:start;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#b8bfd0;font-size:19px;line-height:1;cursor:pointer}.close:hover,.close:focus-visible{background:#2a3040;color:#fff}.actions{display:flex;gap:8px;margin-top:11px}.action{min-height:30px;padding:0 11px;border-radius:8px;font:700 11px/1 Manrope,"Segoe UI",system-ui,sans-serif;cursor:pointer}.action-primary{border:1px solid #5b6cff;background:#5b6cff;color:#fff}.action-secondary{border:1px solid #48526a;background:transparent;color:#e8ebf5}.action:focus-visible,.close:focus-visible{outline:2px solid #b9c3ff;outline-offset:2px}@keyframes enter{from{opacity:0;transform:translate(12px,10px)}to{opacity:1;transform:translate(0,0)}}@media (prefers-reduced-motion:reduce){.toast{animation:none}}</style></head><body><main class="stack">${payloads.map(toastCard).join("")}</main><script>
window.playPicomToastSound=()=>{try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const context=new Ctx();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=660;gain.gain.setValueAtTime(.025,context.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.16);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.16);setTimeout(()=>context.close(),260)}catch{}};const send=(action,notificationId)=>{if(action&&notificationId)void window.picomDesktop?.desktopNotificationToast?.act?.({action,notificationId})};const timers=new Map();document.querySelectorAll('.toast').forEach((card)=>{const id=card.dataset.toast;let paused=false;const remove=()=>{if(!paused&&id)send('dismiss',id)};let timer=setTimeout(remove,${DEFAULT_LIFETIME_MS});timers.set(id,timer);card.addEventListener('mouseenter',()=>{paused=true;clearTimeout(timer)});card.addEventListener('mouseleave',()=>{paused=false;timer=setTimeout(remove,${DEFAULT_LIFETIME_MS});timers.set(id,timer)});card.addEventListener('focusin',()=>{paused=true;clearTimeout(timer)});card.addEventListener('focusout',()=>{paused=false;timer=setTimeout(remove,${DEFAULT_LIFETIME_MS});timers.set(id,timer)});card.addEventListener('click',(event)=>{if(event.target.closest('[data-action]'))return;send('open',id)});});document.querySelectorAll('[data-action]').forEach((button)=>button.addEventListener('click',()=>send(button.dataset.action,button.dataset.id)));</script></body></html>`;
}

function calculateHeight(): number {
  return Math.min(450, Math.max(108, activeToasts.length * 126 + Math.max(0, activeToasts.length - 1) * 10 + 4));
}

function render(): void {
  if (!toastWindow || toastWindow.isDestroyed()) return;
  const height = calculateHeight();
  toastWindow.setSize(TOAST_WIDTH, height, false);
  positionToastHost(toastWindow);
  void toastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildHtml(activeToasts))}`).then(() => {
    if (!toastWindow || toastWindow.isDestroyed() || activeToasts.length === 0) return;
    positionToastHost(toastWindow);
    toastWindow.showInactive();
    if (playSoundAfterRender) {
      playSoundAfterRender = false;
      void toastWindow.webContents.executeJavaScript("window.playPicomToastSound?.()", true).catch(() => undefined);
    }
  });
}

function promoteQueue(): void {
  while (activeToasts.length < MAX_VISIBLE_TOASTS && queue.length > 0) {
    const next = queue.shift();
    if (next) activeToasts = [...activeToasts, next];
  }
}

function clearToast(notificationId: string): void {
  activeToasts = activeToasts.filter((toast) => toast.notificationId !== notificationId);
  queue = queue.filter((toast) => toast.notificationId !== notificationId);
  promoteQueue();
  if (activeToasts.length === 0) {
    toastWindow?.hide();
    return;
  }
  render();
}

function isAllowedAction(value: unknown): value is DesktopNotificationToastAction {
  return value === "open" || value === "dismiss" || value === "accept" || value === "decline" || value === "message" || value === "watch-live";
}

export function setDesktopNotificationToastActionHandler(handler: ((action: DesktopNotificationToastAction, notificationId: string) => void) | null): void {
  actionHandler = handler;
}

export function isDesktopNotificationToastSender(event: IpcMainInvokeEvent): boolean {
  return Boolean(toastWindow && !toastWindow.isDestroyed() && event.sender === toastWindow.webContents);
}

export function resolveDesktopNotificationToastPreloadPath(): string {
  return require("node:path").join(__dirname, "preload.cjs");
}

export function showDesktopNotificationToast(payload: DesktopNotificationToastPayload, preloadPath: string): void {
  const normalized: DesktopNotificationToastPayload = {
    ...payload,
    title: safeText(payload.title, 160),
    body: safeText(payload.body, 320),
    closeLabel: safeText(payload.closeLabel, 80),
    soundEnabled: payload.soundEnabled === true,
  };
  if (activeToasts.some((toast) => toast.notificationId === normalized.notificationId) || queue.some((toast) => toast.notificationId === normalized.notificationId)) return;
  if (!toastWindow || toastWindow.isDestroyed()) {
    toastWindow = new BrowserWindow({
      width: TOAST_WIDTH,
      height: 108,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      title: "PICOM notifications",
      webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
    });
    toastWindow.setAlwaysOnTop(true, "screen-saver");
    toastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    toastWindow.on("closed", () => { toastWindow = null; });
  }
  if (normalized.soundEnabled && Date.now() - lastSoundAt >= 2_500) {
    playSoundAfterRender = true;
    lastSoundAt = Date.now();
  }
  queue.push(normalized);
  promoteQueue();
  render();
}

export function handleDesktopNotificationToastAction(action: unknown, notificationId: unknown): boolean {
  if (!isAllowedAction(action) || typeof notificationId !== "string" || !activeToasts.some((toast) => toast.notificationId === notificationId)) return false;
  clearToast(notificationId);
  actionHandler?.(action, notificationId);
  return true;
}

export function dismissAllDesktopNotificationToasts(): void {
  queue = [];
  activeToasts = [];
  toastWindow?.hide();
}

function repositionForDisplayChange(): void {
  if (toastWindow && !toastWindow.isDestroyed() && activeToasts.length > 0) positionToastHost(toastWindow);
}

/**
 * The Electron screen module is unavailable until app.whenReady(). Registering
 * its events during module evaluation crashes the main process before login.
 */
export function initializeDesktopNotificationToastHost(): void {
  if (displayEventsRegistered) return;
  displayEventsRegistered = true;
  screen.on("display-added", repositionForDisplayChange);
  screen.on("display-removed", repositionForDisplayChange);
  screen.on("display-metrics-changed", repositionForDisplayChange);
}
