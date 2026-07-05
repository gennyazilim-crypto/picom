import { handleCorsPreflight } from "../_shared/cors.ts";
import { validateImageMetadata } from "../_shared/file-validation.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

type ValidateFileRequest = {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type ValidationFailureCode = "UNSUPPORTED_MIME_TYPE" | "UNSUPPORTED_EXTENSION" | "FILE_TOO_LARGE" | "VALIDATION_ERROR";

async function readJsonBody(request: Request): Promise<ValidateFileRequest | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function toEdgeErrorCode(code: ValidationFailureCode): "UPLOAD_INVALID_TYPE" | "UPLOAD_TOO_LARGE" | "VALIDATION_ERROR" {
  if (code === "FILE_TOO_LARGE") return "UPLOAD_TOO_LARGE";
  if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";

  return "UPLOAD_INVALID_TYPE";
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const validation = validateImageMetadata(body?.fileName, body?.mimeType, body?.sizeBytes);

  if (!validation.ok) {
    return errorResponse(toEdgeErrorCode(validation.code), validation.message, 400, {
      valid: false,
      reason: validation.code,
    });
  }

  return jsonResponse({
    valid: true,
    sanitizedFileName: validation.sanitizedFileName,
  });
});
