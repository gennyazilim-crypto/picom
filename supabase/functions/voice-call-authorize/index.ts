import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Body = {
  kind?: "community" | "direct";
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  callId?: string;
  targetUserId?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKeys = new Set(["kind", "communityId", "channelId", "conversationId", "callId", "targetUserId"]);

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonObject<Body>(request, { maxBytes: 1536, allowedKeys });
  if (!parsed.ok) return parsed.response;

  const body = parsed.body;
  const kind = body.kind ?? "community";
  if (!body.targetUserId || !uuidPattern.test(body.targetUserId)) {
    return errorResponse("VALIDATION_ERROR", "A valid targetUserId is required.", 400);
  }
  if (body.targetUserId === auth.user.id) {
    return errorResponse("VALIDATION_ERROR", "You cannot invite yourself to a voice call.", 400);
  }

  const { data: limitRows, error: limitError } = await auth.supabase.rpc("consume_current_user_action_rate_limit", {
    target_action: "livekit_token",
  });
  const limit = Array.isArray(limitRows) ? limitRows[0] as { is_allowed?: boolean; retry_after_seconds?: number } | undefined : undefined;
  if (limitError || !limit?.is_allowed) {
    return errorResponse("RATE_LIMITED", "Too many invite attempts. Try again shortly.", 429, undefined, {
      "Retry-After": String(Math.min(Math.max(Number(limit?.retry_after_seconds) || 30, 1), 3600)),
    });
  }

  if (kind === "direct") {
    if (!body.conversationId || !uuidPattern.test(body.conversationId)) {
      return errorResponse("VALIDATION_ERROR", "A valid conversationId is required for direct invites.", 400);
    }
    if (body.callId !== undefined && !uuidPattern.test(body.callId)) {
      return errorResponse("VALIDATION_ERROR", "A valid callId is required for a persisted direct call.", 400);
    }

    if (body.callId) {
      const { data: callRows, error: callError } = await auth.supabase.rpc("authorize_direct_call_livekit", {
        target_call_id: body.callId,
        target_intent: "voice",
      });
      const callAuthorization = Array.isArray(callRows) ? callRows[0] as { conversation_id?: string } | undefined : undefined;
      if (callError || callAuthorization?.conversation_id !== body.conversationId) {
        return errorResponse("VOICE_DIRECT_FORBIDDEN", "This direct call is unavailable or does not belong to the conversation.", 403);
      }
    }

    const { data: directRows, error: directError } = await auth.supabase.rpc("authorize_direct_livekit_room", {
      target_conversation_id: body.conversationId,
      target_intent: "voice",
    });
    const directAuthorization = Array.isArray(directRows) ? directRows[0] : undefined;
    if (directError || !directAuthorization) {
      return errorResponse("VOICE_DIRECT_FORBIDDEN", "You cannot invite someone to this conversation.", 403);
    }

    const { data: targetMembership, error: targetError } = await auth.supabase
      .from("direct_conversation_participants")
      .select("user_id")
      .eq("conversation_id", body.conversationId)
      .eq("user_id", body.targetUserId)
      .maybeSingle();
    if (targetError || !targetMembership) {
      return errorResponse("VOICE_INVITE_FORBIDDEN", "That person is not in this direct conversation.", 403);
    }

    return jsonResponse({ ok: true, kind: "direct", conversationId: body.conversationId, callId: body.callId, targetUserId: body.targetUserId });
  }

  if (!body.communityId || !body.channelId || !uuidPattern.test(body.communityId) || !uuidPattern.test(body.channelId)) {
    return errorResponse("VALIDATION_ERROR", "A valid communityId and channelId are required.", 400);
  }

  const { data: authorizationRows, error: authorizationError } = await auth.supabase.rpc("authorize_livekit_room", {
    target_community_id: body.communityId,
    target_channel_id: body.channelId,
    target_intent: "voice",
  });
  const authorization = Array.isArray(authorizationRows) ? authorizationRows[0] : undefined;
  if (authorizationError || !authorization) {
    return errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot invite people into this voice channel.", 403);
  }

  const { data: membership, error: membershipError } = await auth.supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", body.communityId)
    .eq("user_id", body.targetUserId)
    .maybeSingle();
  if (membershipError || !membership) {
    return errorResponse("VOICE_INVITE_FORBIDDEN", "That person is not a member of this community.", 403);
  }

  const url = Deno.env.get("LIVEKIT_URL")?.trim();
  const apiKey = Deno.env.get("LIVEKIT_API_KEY")?.trim();
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")?.trim();
  if (!url || !apiKey || !apiSecret) {
    return errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503);
  }

  return jsonResponse({
    ok: true,
    kind: "community",
    communityId: body.communityId,
    channelId: body.channelId,
    targetUserId: body.targetUserId,
  });
});
