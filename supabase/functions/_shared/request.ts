import { errorResponse } from "./http.ts";

type BoundedJsonOptions = Readonly<{ maxBytes: number; allowedKeys?: ReadonlySet<string> }>;
type BoundedJsonResult<T> = Readonly<{ ok: true; body: T }> | Readonly<{ ok: false; response: Response }>;

export async function readBoundedJsonObject<T>(request: Request, options: BoundedJsonOptions): Promise<BoundedJsonResult<T>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Content-Type must be application/json.", 415) };
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
    return { ok: false, response: errorResponse("PAYLOAD_TOO_LARGE", "Request body is too large.", 413) };
  }
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > options.maxBytes) {
    return { ok: false, response: errorResponse(text ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR", text ? "Request body is too large." : "A JSON request body is required.", text ? 413 : 400) };
  }
  try {
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    if (options.allowedKeys && Object.keys(body).some((key) => !options.allowedKeys?.has(key))) throw new Error("unsupported key");
    return { ok: true, body: body as T };
  } catch {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Request body must be a supported JSON object.", 400) };
  }
}
