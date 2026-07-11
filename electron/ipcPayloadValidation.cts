export type WindowAction = "minimize" | "maximize" | "close";
export type TrayStatus = "online" | "idle" | "dnd" | "invisible";
export type SafeNotificationPayload = Readonly<{ title: string; body?: string; silent?: boolean; deepLink?: string }>;
export const MAX_CLIPBOARD_TEXT_LENGTH = 1024 * 1024;
export type ScreenCaptureListPayload = Readonly<{ requestId: string; userInitiated: true }>;
export type ScreenCaptureSelectionPayload = Readonly<{ requestId: string; sourceId: string }>;

const safeDeepLinkSegmentPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const safeScreenCaptureRequestIdPattern = /^[a-f0-9-]{16,64}$/i;
const safeScreenCaptureSourceIdPattern = /^(screen|window):[a-zA-Z0-9:_-]{1,240}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}

export function isSafeScreenCaptureSourceId(value: unknown): value is string {
  return typeof value === "string" && safeScreenCaptureSourceIdPattern.test(value);
}

export function parseScreenCaptureListPayload(value: unknown): ScreenCaptureListPayload | null {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["requestId", "userInitiated"])) return null;
  if (typeof value.requestId !== "string" || !safeScreenCaptureRequestIdPattern.test(value.requestId) || value.userInitiated !== true) return null;
  return { requestId: value.requestId, userInitiated: true };
}

export function parseScreenCaptureSelectionPayload(value: unknown): ScreenCaptureSelectionPayload | null {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["requestId", "sourceId"])) return null;
  if (typeof value.requestId !== "string" || !safeScreenCaptureRequestIdPattern.test(value.requestId) || !isSafeScreenCaptureSourceId(value.sourceId)) return null;
  return { requestId: value.requestId, sourceId: value.sourceId };
}

export function parseScreenCaptureCancelPayload(value: unknown): Readonly<{ requestId: string }> | null {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["requestId"])) return null;
  if (typeof value.requestId !== "string" || !safeScreenCaptureRequestIdPattern.test(value.requestId)) return null;
  return { requestId: value.requestId };
}

export function isWindowAction(action: unknown): action is WindowAction {
  return action === "minimize" || action === "maximize" || action === "close";
}

export function isTrayStatus(status: unknown): status is TrayStatus {
  return status === "online" || status === "idle" || status === "dnd" || status === "invisible";
}

export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > 2048) return null;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function isSafeDeepLinkSegment(value: string | undefined): value is string {
  return Boolean(value && safeDeepLinkSegmentPattern.test(value));
}

function isSupportedPicomDeepLink(parsed: URL): boolean {
  if (parsed.protocol !== "picom:" || parsed.username || parsed.password || parsed.hash) return false;
  const route = parsed.hostname;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (route === "auth" && segments.length === 1 && segments[0] === "callback") {
    const allowedKeys = new Set(["code", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }
  if (route === "auth" && segments.length === 1 && segments[0] === "reset-password") {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const type = parsed.searchParams.get("type");
    if (type && type !== "recovery") return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }
  if (route === "auth" && segments.length === 1 && segments[0] === "verify-email") {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return false;
    const type = parsed.searchParams.get("type");
    if (type && type !== "signup" && type !== "email_change") return false;
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    return Boolean((code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) || (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)));
  }
  if (parsed.search) return false;
  if (route === "invite") return segments.length === 1 && isSafeDeepLinkSegment(segments[0]);
  if (route === "community") {
    const [communityId, channelKeyword, channelId, messageKeyword, messageId] = segments;
    if (!isSafeDeepLinkSegment(communityId)) return false;
    if (segments.length === 1) return true;
    if (segments.length === 3) return channelKeyword === "channel" && isSafeDeepLinkSegment(channelId);
    if (segments.length === 5) return channelKeyword === "channel" && isSafeDeepLinkSegment(channelId) && messageKeyword === "message" && isSafeDeepLinkSegment(messageId);
  }
  if ((route === "radio" || route === "podcast") && segments.length === 3) {
    const expectedKind = route === "radio" ? "session" : "episode";
    return segments[1] === expectedKind && isSafeDeepLinkSegment(segments[0]) && isSafeDeepLinkSegment(segments[2]);
  }
  if (route === "meeting") {
    const safe = (index: number) => isSafeDeepLinkSegment(segments[index]);
    if (segments.length===3) return safe(0)&&segments[1]==="room"&&safe(2);
    if (segments.length===5&&segments[1]==="room") return safe(0)&&safe(2)&&segments[3]==="session"&&safe(4);
    if (segments[1]!=="channel"||segments[3]!=="room"||!safe(0)||!safe(2)||!safe(4)) return false;
    if (segments.length===5) return true;
    if (segments.length===6) return segments[5]==="chat";
    if (segments.length===7) return segments[5]==="session"&&safe(6);
    if (segments.length===8) return (segments[5]==="chat"&&segments[6]==="message"&&safe(7))||(segments[5]==="session"&&safe(6)&&segments[7]==="chat");
    return segments.length===10&&segments[5]==="session"&&safe(6)&&segments[7]==="chat"&&segments[8]==="message"&&safe(9);
  }
  return (route === "settings" || route === "friends") && segments.length === 0;
}

export function isSafeDeepLink(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2048) return false;
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) return false;
  try { return isSupportedPicomDeepLink(new URL(value)); } catch { return false; }
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function parseNotificationPayload(value: unknown): SafeNotificationPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = sanitizeText(record.title, 120);
  if (!title) return null;
  const deepLink = isSafeDeepLink(record.deepLink) ? record.deepLink : undefined;
  return { title, body: sanitizeText(record.body, 240), silent: typeof record.silent === "boolean" ? record.silent : undefined, deepLink };
}

function sanitizeDefaultFileName(value: unknown): string {
  const fallback = "picom-export.txt";
  const raw = sanitizeText(value, 120) ?? fallback;
  const safe = raw.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return safe || fallback;
}

export function parseSaveTextPayload(value: unknown): { defaultPath: string; content: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.content !== "string") return null;
  return { defaultPath: sanitizeDefaultFileName(record.defaultPath), content: record.content.slice(0, 2 * 1024 * 1024) };
}

export function parseClipboardWritePayload(value: unknown): string | null {
  return typeof value === "string" ? value.slice(0, MAX_CLIPBOARD_TEXT_LENGTH) : null;
}
