import { corsHeaders } from "./cors.ts";

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
  return jsonResponse(
    {
      code: "METHOD_NOT_ALLOWED",
      message: `Method not allowed. Use ${allowed.join(", ")}.`,
    },
    {
      status: 405,
      headers: {
        Allow: allowed.join(", "),
      },
    },
  );
}
