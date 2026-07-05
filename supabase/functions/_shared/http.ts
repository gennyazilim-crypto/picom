import { corsHeaders } from "./cors.ts";
import { createEdgeErrorBody, type EdgeErrorCode } from "./errors.ts";

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return errorResponse("METHOD_NOT_ALLOWED", `Method not allowed. Use ${allowed.join(", ")}.`, 405, undefined, {
    Allow: allowed.join(", "),
  });
}

export function errorResponse(
  code: EdgeErrorCode,
  message: string,
  status = 400,
  details?: unknown,
  headers?: HeadersInit,
): Response {
  return jsonResponse(createEdgeErrorBody(code, message, details), {
    status,
    headers: {
      ...(headers ?? {}),
    },
  });
}
