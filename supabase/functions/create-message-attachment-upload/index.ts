import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Input = {
  communityId?: string;
  channelId?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mimeExtensions: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const allowedKeys = new Set(["communityId", "channelId", "fileName", "mimeType", "sizeBytes"]);

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonObject<Input>(request, { maxBytes: 4096, allowedKeys });
  if (!parsed.ok) return parsed.response;

  const { communityId, channelId, fileName, mimeType, sizeBytes } = parsed.body;
  const extension = mimeType ? mimeExtensions[mimeType] : undefined;
  const maximumBytes = mimeType?.startsWith("video/") ? maxVideoBytes : maxImageBytes;
  if (!communityId || !channelId || !fileName || !mimeType || !extension || !uuidPattern.test(communityId) || !uuidPattern.test(channelId)
    || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maximumBytes || fileName.length > 128) {
    return errorResponse("VALIDATION_ERROR", "A supported media file and valid community channel are required.", 400);
  }

  const [{ data: membership, error: membershipError }, { data: channel, error: channelError }] = await Promise.all([
    auth.supabase.from("community_members").select("community_id").eq("community_id", communityId).eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("channels").select("id").eq("id", channelId).eq("community_id", communityId).maybeSingle(),
  ]);
  if (membershipError || channelError || !membership || !channel) {
    return errorResponse("ATTACHMENT_UPLOAD_FORBIDDEN", "You cannot upload an attachment to this channel.", 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return errorResponse("SUPABASE_NOT_CONFIGURED", "Secure attachment uploads are not configured.", 503);

  const storagePath = `communities/${communityId}/channels/${channelId}/pending/${auth.user.id}/${crypto.randomUUID()}.${extension}`;
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const signed = await admin.storage.from("message-attachments").createSignedUploadUrl(storagePath, { upsert: false });
  if (signed.error || !signed.data) return errorResponse("INTERNAL_ERROR", "Picom could not authorize this attachment upload.", 503);

  return jsonResponse({ path: storagePath, token: signed.data.token });
});
