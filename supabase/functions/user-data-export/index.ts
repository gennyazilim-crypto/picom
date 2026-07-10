import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

const SECTION_LIMIT = 5000;

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

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
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("INTERNAL_ERROR", "Data export processing is unavailable.", 503);

  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentRequest } = await auth.supabase
    .from("data_export_requests")
    .select("id,status,requested_at")
    .eq("user_id", auth.user.id)
    .gte("requested_at", recentCutoff)
    .in("status", ["requested", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentRequest) return errorResponse("VALIDATION_ERROR", "A recent data export request is already processing. Try again later.", 429, undefined, { "Retry-After": "600" });

  const { data: requestRow, error: requestError } = await auth.supabase
    .from("data_export_requests")
    .insert({ user_id: auth.user.id, status: "requested", format: "json" })
    .select("id,requested_at")
    .single();
  if (requestError || !requestRow) return errorResponse("INTERNAL_ERROR", "Picom could not create the export request.", 500);

  const operator = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await operator.from("data_export_requests").update({ status: "processing" }).eq("id", requestRow.id).eq("user_id", auth.user.id);

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
    await operator.from("data_export_requests").update({ status: "failed", completed_at: new Date().toISOString(), failure_code: "EXPORT_QUERY_FAILED" }).eq("id", requestRow.id).eq("user_id", auth.user.id);
    return errorResponse("INTERNAL_ERROR", "Picom could not generate the data export safely.", 500);
  }

  const memberships = takeBounded(membershipsResult.data);
  const messages = takeBounded(messagesResult.data);
  const attachments = takeBounded(attachmentsResult.data);
  const follows = takeBounded(followsResult.data);
  const savedMessages = takeBounded(savedResult.data);
  const completedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await operator.from("data_export_requests").update({ status: "ready", completed_at: completedAt, expires_at: expiresAt, failure_code: null }).eq("id", requestRow.id).eq("user_id", auth.user.id);

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
