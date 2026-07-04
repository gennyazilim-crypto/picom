import { handleCorsPreflight } from "../_shared/cors.ts";
import { validateImageMetadata } from "../_shared/file-validation.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";

type ValidateFileRequest = {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

async function readJsonBody(request: Request): Promise<ValidateFileRequest | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ code: "AUTH_REQUIRED", message: "Sign in before validating uploads." }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const validation = validateImageMetadata(body?.fileName, body?.mimeType, body?.sizeBytes);

  if (!validation.ok) {
    return jsonResponse({ code: validation.code, message: validation.message, valid: false }, { status: 400 });
  }

  return jsonResponse({
    valid: true,
    sanitizedFileName: validation.sanitizedFileName,
  });
});
