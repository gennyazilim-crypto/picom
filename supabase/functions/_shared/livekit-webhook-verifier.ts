export type LiveKitWebhookClaims = Readonly<{ iss: string; exp: number; nbf?: number; iat?: number; sha256: string }>;
export type VerifiedLiveKitWebhook = Readonly<{ claims: LiveKitWebhookClaims; payloadDigestHex: string }>;

const encoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid webhook JWT JSON");
  return parsed as Record<string, unknown>;
}

function standardBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyLiveKitWebhook(rawBody: string, authorizationHeader: string | null, apiKey: string, apiSecret: string): Promise<VerifiedLiveKitWebhook> {
  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorizationHeader?.trim() ?? "");
  if (!match) throw new Error("missing webhook authorization");
  const token = match[1];
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) throw new Error("unsupported webhook JWT");
  const key = await crypto.subtle.importKey("raw", encoder.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("HMAC", key, decodeBase64Url(encodedSignature), encoder.encode(`${encodedHeader}.${encodedPayload}`));
  if (!verified) throw new Error("invalid webhook signature");
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const nbf = payload.nbf === undefined ? undefined : Number(payload.nbf);
  if (payload.iss !== apiKey || !Number.isFinite(exp) || exp < now - 30 || exp > now + 15 * 60 || (nbf !== undefined && (!Number.isFinite(nbf) || nbf > now + 30))) throw new Error("invalid webhook claims");
  if (typeof payload.sha256 !== "string" || !payload.sha256) throw new Error("missing webhook body hash");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(rawBody)));
  if (!safeEqual(payload.sha256, standardBase64(digest))) throw new Error("webhook body hash mismatch");
  return { claims: { iss: apiKey, exp, ...(nbf === undefined ? {} : { nbf }), ...(typeof payload.iat === "number" ? { iat: payload.iat } : {}), sha256: payload.sha256 }, payloadDigestHex: hex(digest) };
}
