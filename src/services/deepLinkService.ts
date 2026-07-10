export type DeepLinkAction =
  | { type: "invite"; code: string }
  | { type: "community"; communityId: string; channelId?: string; messageId?: string }
  | { type: "authCallback"; code?: string; error?: string }
  | { type: "passwordRecovery"; code?: string; error?: string }
  | { type: "emailVerification"; code?: string; error?: string }
  | { type: "settings" }
  | { type: "friends" };

export type DeepLinkParseResult =
  | { ok: true; url: string; action: DeepLinkAction }
  | { ok: false; reason: string };

type DeepLinkListener = (action: DeepLinkAction) => void;

const listeners = new Set<DeepLinkListener>();
let nativeCleanup: (() => void) | null = null;
const maxDeepLinkLength = 2048;
const safeSegmentPattern = /^[a-zA-Z0-9_-]{1,128}$/;

function isSafeSegment(value: string | undefined): value is string {
  return Boolean(value && safeSegmentPattern.test(value));
}

function parseCommunityLink(segments: string[]): DeepLinkParseResult {
  const [communityId, channelKeyword, channelId, messageKeyword, messageId] = segments;
  if (!isSafeSegment(communityId)) {
    return { ok: false, reason: "INVALID_COMMUNITY_ID" };
  }

  if (channelKeyword === undefined) {
    return { ok: true, url: `picom://community/${communityId}`, action: { type: "community", communityId } };
  }

  if (channelKeyword !== "channel" || !isSafeSegment(channelId)) {
    return { ok: false, reason: "INVALID_CHANNEL_LINK" };
  }

  if (messageKeyword === undefined) {
    return {
      ok: true,
      url: `picom://community/${communityId}/channel/${channelId}`,
      action: { type: "community", communityId, channelId }
    };
  }

  if (messageKeyword !== "message" || !isSafeSegment(messageId)) {
    return { ok: false, reason: "INVALID_MESSAGE_LINK" };
  }

  return {
    ok: true,
    url: `picom://community/${communityId}/channel/${channelId}/message/${messageId}`,
    action: { type: "community", communityId, channelId, messageId }
  };
}

export function parseDeepLink(value: string): DeepLinkParseResult {
  const raw = value.trim();
  if (!raw || raw.length > maxDeepLinkLength) {
    return { ok: false, reason: "INVALID_DEEP_LINK" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "INVALID_DEEP_LINK" };
  }

  if (parsed.protocol !== "picom:") {
    return { ok: false, reason: "UNSUPPORTED_DEEP_LINK_PROTOCOL" };
  }

  const route = parsed.hostname;
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (route === "auth" && segments.length === 1 && segments[0] === "callback" && !parsed.hash) {
    const allowedKeys = new Set(["code", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return { ok: false, reason: "INVALID_AUTH_CALLBACK" };
    const code = parsed.searchParams.get("code") ?? undefined;
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error") ?? undefined;
    if (code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) return { ok: true, url: raw, action: { type: "authCallback", code } };
    if (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)) return { ok: true, url: raw, action: { type: "authCallback", error } };
    return { ok: false, reason: "INVALID_AUTH_CALLBACK" };
  }

  if (route === "auth" && segments.length === 1 && segments[0] === "reset-password" && !parsed.hash) {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return { ok: false, reason: "INVALID_PASSWORD_RECOVERY_LINK" };
    const type = parsed.searchParams.get("type");
    if (type && type !== "recovery") return { ok: false, reason: "INVALID_PASSWORD_RECOVERY_LINK" };
    const code = parsed.searchParams.get("code") ?? undefined;
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error") ?? undefined;
    if (code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) return { ok: true, url: "picom://auth/reset-password", action: { type: "passwordRecovery", code } };
    if (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)) return { ok: true, url: "picom://auth/reset-password", action: { type: "passwordRecovery", error } };
    return { ok: false, reason: "INVALID_PASSWORD_RECOVERY_LINK" };
  }

  if (route === "auth" && segments.length === 1 && segments[0] === "verify-email" && !parsed.hash) {
    const allowedKeys = new Set(["code", "type", "error", "error_description"]);
    if ([...parsed.searchParams.keys()].some((key) => !allowedKeys.has(key))) return { ok: false, reason: "INVALID_EMAIL_VERIFICATION_LINK" };
    const type = parsed.searchParams.get("type");
    if (type && type !== "signup" && type !== "email_change") return { ok: false, reason: "INVALID_EMAIL_VERIFICATION_LINK" };
    const code = parsed.searchParams.get("code") ?? undefined;
    const error = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error") ?? undefined;
    if (code && /^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) return { ok: true, url: "picom://auth/verify-email", action: { type: "emailVerification", code } };
    if (error && error.length <= 240 && !/[\u0000-\u001f]/.test(error)) return { ok: true, url: "picom://auth/verify-email", action: { type: "emailVerification", error } };
    return { ok: false, reason: "INVALID_EMAIL_VERIFICATION_LINK" };
  }

  if (route === "invite") {
    const [code] = segments;
    return isSafeSegment(code)
      ? { ok: true, url: `picom://invite/${code}`, action: { type: "invite", code } }
      : { ok: false, reason: "INVALID_INVITE_CODE" };
  }

  if (route === "community") {
    return parseCommunityLink(segments);
  }

  if (route === "settings" && segments.length === 0) {
    return { ok: true, url: "picom://settings", action: { type: "settings" } };
  }

  if (route === "friends" && segments.length === 0) {
    return { ok: true, url: "picom://friends", action: { type: "friends" } };
  }

  return { ok: false, reason: "UNSUPPORTED_DEEP_LINK_ROUTE" };
}

function dispatchDeepLink(value: string): DeepLinkParseResult {
  const result = parseDeepLink(value);
  if (result.ok) {
    for (const listener of listeners) {
      listener(result.action);
    }
  }

  return result;
}

export const deepLinkService = {
  parseDeepLink,

  startNativeListener(): () => void {
    if (nativeCleanup) {
      return nativeCleanup;
    }

    const bridge = window.picomDesktop?.deepLinks;
    if (!bridge) {
      nativeCleanup = () => undefined;
      return nativeCleanup;
    }

    nativeCleanup = bridge.onOpen((url) => dispatchDeepLink(url));

    return nativeCleanup;
  },

  onDeepLink(listener: DeepLinkListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  handleDeepLink(value: string): DeepLinkParseResult {
    return dispatchDeepLink(value);
  },

  simulateDeepLink(value: string): DeepLinkParseResult {
    return dispatchDeepLink(value);
  }
};
