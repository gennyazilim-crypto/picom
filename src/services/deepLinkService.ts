export type DeepLinkAction =
  | { type: "invite"; code: string }
  | { type: "community"; communityId: string; channelId?: string; messageId?: string }
  | { type: "settings" }
  | { type: "friends" };

export type DeepLinkParseResult =
  | { ok: true; url: string; action: DeepLinkAction }
  | { ok: false; reason: string };

type DeepLinkListener = (action: DeepLinkAction) => void;

const listeners = new Set<DeepLinkListener>();
const maxDeepLinkLength = 512;
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

export const deepLinkService = {
  parseDeepLink,

  onDeepLink(listener: DeepLinkListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  handleDeepLink(value: string): DeepLinkParseResult {
    const result = parseDeepLink(value);
    if (result.ok) {
      for (const listener of listeners) {
        listener(result.action);
      }
    }

    return result;
  },

  simulateDeepLink(value: string): DeepLinkParseResult {
    return this.handleDeepLink(value);
  }
};
