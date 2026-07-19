import { BrowserWindow, screen, type IpcMainInvokeEvent } from "electron";
import path from "node:path";

export type IncomingCallToastAction = "accept" | "decline" | "message";

export type IncomingCallToastPayload = Readonly<{
  inviteId: string;
  callId: string;
  conversationId: string;
  callerId: string;
  callerDisplayName: string;
  callerUsername?: string;
  callType: "voice" | "video";
  startedAt: string;
  subtitle?: string;
  avatarDataUrl?: string;
}>;

let toastWindow: BrowserWindow | null = null;
let activePayload: IncomingCallToastPayload | null = null;
let onAction: ((action: IncomingCallToastAction, inviteId: string) => void) | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return escapeHtml(`${first}${second}`.toUpperCase());
}

function buildHtml(payload: IncomingCallToastPayload): string {
  const name = escapeHtml(payload.callerDisplayName.slice(0, 80));
  const subtitle = escapeHtml((payload.subtitle ?? `Incoming ${payload.callType} call`).slice(0, 120));
  const avatar = payload.avatarDataUrl?.startsWith("data:image/png;base64,")
    ? `<img src="${escapeHtml(payload.avatarDataUrl)}" alt="" />`
    : `<span class="initials">${initials(payload.callerDisplayName)}</span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<title>Incoming call</title>
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif; }
  .shell { width: 100%; height: 100%; display: grid; place-items: end; padding: 0; box-sizing: border-box; }
  .card { position: relative; width: 300px; padding: 12px 12px 14px; border-radius: 28px; background: #fff; border: 1px solid rgba(158,182,200,.34); box-shadow: 0 18px 40px rgba(26,51,72,.18); box-sizing: border-box; }
  .media { position: relative; width: 100%; aspect-ratio: 1 / 1.02; border-radius: 22px; overflow: hidden; background: linear-gradient(160deg,#007571,#10c2bb); }
  .media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .initials { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 58px; font-weight: 700; }
  .actions { position: absolute; top: 4px; right: 4px; display: flex; gap: 8px; z-index: 2; }
  .fab { width: 44px; height: 44px; border-radius: 14px; border: 1px solid rgba(158,182,200,.34); background: #fff; box-shadow: 0 10px 22px rgba(26,51,72,.14); cursor: pointer; display: grid; place-items: center; }
  .fab svg { width: 18px; height: 18px; }
  .fab-message { color: #8b6ad8; }
  .fab-accept { color: #2f9d6a; }
  .meta { text-align: center; padding: 16px 8px 6px; }
  .name { margin: 0; font-size: 1.35rem; font-weight: 700; color: #152033; letter-spacing: -.02em; }
  .subtitle { margin: 4px 0 0; font-size: .92rem; font-weight: 500; color: #7a8798; }
  .decline { display: block; margin: 4px auto 0; border: 0; background: transparent; color: #7a8798; font-size: .8rem; font-weight: 600; cursor: pointer; padding: 8px 12px; }
  .decline:hover { color: #c0392b; }
</style>
</head>
<body>
  <div class="shell">
    <article class="card" role="dialog" aria-label="Incoming call from ${name}">
      <div class="media" aria-hidden="true">${avatar}</div>
      <div class="actions">
        <button class="fab fab-message" type="button" data-action="message" aria-label="Message instead" title="Message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6.5h16v11H8l-4 3v-14z"/></svg>
        </button>
        <button class="fab fab-accept" type="button" data-action="accept" aria-label="Answer call" title="Answer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4.5c1 .8 1.7 2.1 1.9 3.4-.1.6-.5 1.1-1 1.5l-1.2.9c1.5 3 3.9 5.4 6.9 6.9l.9-1.2c.4-.5.9-.9 1.5-1 .3.1.8.3 1.3.5.8.3 1.6.6 2.1 1.1v3.2c-4.6 1.7-10-1.1-13.3-5.2C3.4 11.4 2.3 6.8 4.2 3.8H7z"/></svg>
        </button>
      </div>
      <div class="meta">
        <h1 class="name">${name}</h1>
        <p class="subtitle">${subtitle}</p>
      </div>
      <button class="decline" type="button" data-action="decline">Decline</button>
    </article>
  </div>
  <script>
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-action");
        if (window.picomDesktop?.incomingCall?.respond && action) {
          void window.picomDesktop.incomingCall.respond(action);
        }
      });
    });
  </script>
</body>
</html>`;
}

function positionToast(win: BrowserWindow): void {
  const display = screen.getPrimaryDisplay();
  const { width: workWidth, height: workHeight, x, y } = display.workArea;
  const bounds = win.getBounds();
  win.setPosition(
    Math.round(x + workWidth - bounds.width - 20),
    Math.round(y + workHeight - bounds.height - 20),
  );
}

export function setIncomingCallToastActionHandler(
  handler: ((action: IncomingCallToastAction, inviteId: string) => void) | null,
): void {
  onAction = handler;
}

export function isIncomingCallToastSender(event: IpcMainInvokeEvent): boolean {
  return Boolean(toastWindow && !toastWindow.isDestroyed() && event.sender === toastWindow.webContents);
}

export function getActiveIncomingCallInviteId(): string | null {
  return activePayload?.inviteId ?? null;
}

export function dismissIncomingCallToast(): void {
  activePayload = null;
  if (!toastWindow || toastWindow.isDestroyed()) {
    toastWindow = null;
    return;
  }
  toastWindow.close();
  toastWindow = null;
}

export function showIncomingCallToast(payload: IncomingCallToastPayload, preloadPath: string): void {
  dismissIncomingCallToast();
  activePayload = payload;

  toastWindow = new BrowserWindow({
    width: 324,
    height: 430,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    title: "Picom Incoming Call",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  toastWindow.setAlwaysOnTop(true, "screen-saver");
  toastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  positionToast(toastWindow);

  toastWindow.on("closed", () => {
    toastWindow = null;
  });

  void toastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildHtml(payload))}`).then(() => {
    if (!toastWindow || toastWindow.isDestroyed()) return;
    positionToast(toastWindow);
    toastWindow.showInactive();
  });
}

export function handleIncomingCallToastResponse(action: IncomingCallToastAction): boolean {
  const inviteId = activePayload?.inviteId;
  if (!inviteId) return false;
  dismissIncomingCallToast();
  onAction?.(action, inviteId);
  return true;
}

export function resolveIncomingCallPreloadPath(): string {
  return path.join(__dirname, "preload.cjs");
}
