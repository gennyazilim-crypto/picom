import { handleCorsPreflight } from "../_shared/cors.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";

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

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ code: "AUTH_REQUIRED", message: "Sign in before triggering notification fanout." }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (!isFanoutEventType(body?.eventType)) {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "A valid notification eventType is required." }, { status: 400 });
  }

  if (body.communityId && !uuidPattern.test(body.communityId)) {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "communityId must be a valid UUID when provided." }, { status: 400 });
  }

  if (body.channelId && !uuidPattern.test(body.channelId)) {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "channelId must be a valid UUID when provided." }, { status: 400 });
  }

  if (body.messageId && !uuidPattern.test(body.messageId)) {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "messageId must be a valid UUID when provided." }, { status: 400 });
  }

  return jsonResponse(
    {
      code: "NOTIFICATION_FANOUT_NOT_IMPLEMENTED",
      message: "Notification fanout is prepared but not enabled yet.",
      eventType: body.eventType,
      delivered: false,
    },
    { status: 501 },
  );
});
