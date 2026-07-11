export interface LiveKitTokenInput {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  roomName: string;
  ttlSeconds?: number;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  canPublishSources?: readonly ("camera" | "microphone" | "screen_share" | "screen_share_audio")[];
}

export interface LiveKitTokenResult {
  token: string;
  expiresAt: string;
}

const encoder = new TextEncoder();

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signHmacSha256(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));

  return encodeBase64Url(new Uint8Array(signature));
}

export async function createLiveKitToken({
  apiKey,
  apiSecret,
  identity,
  name,
  roomName,
  ttlSeconds = 60 * 60,
  canPublish = false,
  canSubscribe = true,
  canPublishData = false,
  canPublishSources = [],
}: LiveKitTokenInput): Promise<LiveKitTokenResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + ttlSeconds;

  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      name,
      nbf: nowSeconds - 5,
      exp: expiresAtSeconds,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish,
        canSubscribe,
        canPublishData,
        canPublishSources,
      },
    }),
  );

  const unsignedToken = `${header}.${payload}`;
  const signature = await signHmacSha256(unsignedToken, apiSecret);

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}
