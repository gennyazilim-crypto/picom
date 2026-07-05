import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

type FanoutEventType = "message_mention" | "direct_message" | "community_announcement" | "system_notice";

type FanoutRequest = {
  eventType?: FanoutEventType;
  communityId?: string;
  channelId?: string;
  messageId?: string;
};

const allowedEvents: FanoutEventType[] = ["message_mention", "direct_message", "community_announcement", "system_notice"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJsonBody(request: Request): Promise<FanoutRequest | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isFanoutEventType(value: unknown): value is FanoutEventType {
  return typeof value === "string" && allowedEvents.includes(value as FanoutEventType);
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

  if (!isFanoutEventType(body?.eventType)) {
    return errorResponse("VALIDATION_ERROR", "A valid notification eventType is required.", 400);
  }

  if (body.communityId && !uuidPattern.test(body.communityId)) {
    return errorResponse("VALIDATION_ERROR", "communityId must be a valid UUID when provided.", 400);
  }

  if (body.channelId && !uuidPattern.test(body.channelId)) {
    return errorResponse("VALIDATION_ERROR", "channelId must be a valid UUID when provided.", 400);
  }

  if (body.messageId && !uuidPattern.test(body.messageId)) {
    return errorResponse("VALIDATION_ERROR", "messageId must be a valid UUID when provided.", 400);
  }

  return errorResponse(
    "NOTIFICATION_FANOUT_NOT_IMPLEMENTED",
    "Notification fanout is prepared but not enabled yet.",
    501,
    {
      eventType: body.eventType,
      delivered: false,
    },
  );
});
