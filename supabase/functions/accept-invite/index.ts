import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

type AcceptInviteRequest = {
  code?: string;
};

function normalizeInviteCode(code: unknown): string | null {
  if (typeof code !== "string") return null;

  const normalized = code.trim();
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(normalized)) return null;

  return normalized;
}

async function readJsonBody(request: Request): Promise<AcceptInviteRequest | null> {
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

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const code = normalizeInviteCode(body?.code);

  if (!code) {
    return errorResponse("VALIDATION_ERROR", "A valid invite code is required.", 400);
  }

  return jsonResponse({
    code: "INVITE_ACCEPTANCE_NOT_IMPLEMENTED",
    message: "Invite acceptance is prepared but not enabled yet.",
    accepted: false,
  }, { status: 501 });
});
