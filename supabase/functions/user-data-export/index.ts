import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

const SECTION_LIMIT = 5000;

function takeBounded<T>(rows: T[] | null): { items: T[]; truncated: boolean } {
  const source = rows ?? [];
  return { items: source.slice(0, SECTION_LIMIT), truncated: source.length > SECTION_LIMIT };
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const { data: started, error: startError } = await auth.supabase.rpc("begin_own_data_export");
  const requestRow = started?.[0];
  if (startError?.message?.includes("EXPORT_ALREADY_PROCESSING")) return errorResponse("RATE_LIMITED", "A recent data export is already processing. Try again later.", 429, undefined, { "Retry-After": "600" });
  if (startError || !requestRow) return errorResponse("INTERNAL_ERROR", "Picom could not create the export request.", 500);

  const [profileResult, membershipsResult, messagesResult, attachmentsResult, followsResult, savedResult] = await Promise.all([
    auth.supabase.from("profiles").select("id,username,display_name,avatar_url,status,status_text,bio,accent_color,onboarding_completed,created_at,updated_at").eq("id", auth.user.id).single(),
    auth.supabase.from("community_members").select("id,community_id,role_id,joined_at").eq("user_id", auth.user.id).order("joined_at", { ascending: true }).limit(SECTION_LIMIT + 1),
    auth.supabase.from("messages").select("id,community_id,channel_id,body,client_message_id,created_at,edited_at,deleted_at,webhook_id").eq("author_id", auth.user.id).order("created_at", { ascending: true }).limit(SECTION_LIMIT + 1),
    auth.supabase.from("attachments").select("id,message_id,file_name,mime_type,size_bytes,attachment_type,width,height,status,created_at").eq("uploader_id", auth.user.id).order("created_at", { ascending: true }).limit(SECTION_LIMIT + 1),
    auth.supabase.from("user_follows").select("id,followed_id,created_at").eq("follower_id", auth.user.id).order("created_at", { ascending: true }).limit(SECTION_LIMIT + 1),
    auth.supabase.from("saved_messages").select("id,message_id,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: true }).limit(SECTION_LIMIT + 1),
  ]);

  const queryError = profileResult.error || membershipsResult.error || messagesResult.error || attachmentsResult.error || followsResult.error || savedResult.error;
  if (queryError || !profileResult.data) {
    await auth.supabase.rpc("complete_own_data_export", { target_export_id: requestRow.id, next_status: "failed", next_failure_code: "EXPORT_QUERY_FAILED" });
    return errorResponse("INTERNAL_ERROR", "Picom could not generate the data export safely.", 500);
  }

  const memberships = takeBounded(membershipsResult.data);
  const messages = takeBounded(messagesResult.data);
  const attachments = takeBounded(attachmentsResult.data);
  const follows = takeBounded(followsResult.data);
  const savedMessages = takeBounded(savedResult.data);
  const { data: completed, error: completeError } = await auth.supabase.rpc("complete_own_data_export", { target_export_id: requestRow.id, next_status: "ready", next_failure_code: null });
  const completedRow = completed?.[0];
  if (completeError || !completedRow) return errorResponse("INTERNAL_ERROR", "Picom could not finalize the data export safely.", 500);
  const completedAt = completedRow.completed_at;
  const expiresAt = completedRow.expires_at;

  return jsonResponse({
    schemaVersion: 1,
    exportId: requestRow.id,
    requestedAt: requestRow.requested_at,
    generatedAt: completedAt,
    expiresAt,
    profile: profileResult.data,
    communityMemberships: memberships.items,
    ownMessages: messages.items,
    attachmentMetadata: attachments.items,
    follows: follows.items,
    savedMessages: savedMessages.items,
    truncated: {
      communityMemberships: memberships.truncated,
      ownMessages: messages.truncated,
      attachmentMetadata: attachments.truncated,
      follows: follows.truncated,
      savedMessages: savedMessages.truncated,
    },
    excluded: [
      "password hashes", "session and refresh tokens", "authorization headers", "cookies", "service-role keys",
      "LiveKit and signing secrets", "raw storage paths", "audit logs", "other users' private data",
    ],
    note: "Server sections were queried with the authenticated user's RLS context. Local desktop settings are merged by the Picom client after this response.",
  }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
});
