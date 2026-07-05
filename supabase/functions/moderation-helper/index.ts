import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

type ModerationAction = "delete_message" | "kick_member" | "ban_member" | "timeout_member";

type ModerationRequest = {
  communityId?: string;
  targetId?: string;
  action?: ModerationAction;
  reason?: string;
};

const allowedActions: ModerationAction[] = ["delete_message", "kick_member", "ban_member", "timeout_member"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJsonBody(request: Request): Promise<ModerationRequest | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isModerationAction(action: unknown): action is ModerationAction {
  return typeof action === "string" && allowedActions.includes(action as ModerationAction);
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

  if (!body?.communityId || !uuidPattern.test(body.communityId)) {
    return errorResponse("VALIDATION_ERROR", "A valid communityId is required.", 400);
  }

  if (!body.targetId || typeof body.targetId !== "string" || body.targetId.trim().length < 3) {
    return errorResponse("VALIDATION_ERROR", "A valid targetId is required.", 400);
  }

  if (!isModerationAction(body.action)) {
    return errorResponse("VALIDATION_ERROR", "A valid moderation action is required.", 400);
  }

  return errorResponse(
    "MODERATION_HELPER_NOT_IMPLEMENTED",
    "Moderation helper is prepared but not enabled yet.",
    501,
    {
      action: body.action,
      applied: false,
    },
  );
});
