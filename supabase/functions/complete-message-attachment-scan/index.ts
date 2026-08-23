import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Input = { attachmentId?: string };

const uuidSource = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidPattern = new RegExp(`^${uuidSource}$`, "i");
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;

function matchesDeclaredImage(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") return bytes.length >= 6 && (new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a");
  if (mimeType === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

function matchesDeclaredVideo(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "video/mp4") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  if (mimeType === "video/webm") return bytes.length >= 4 && bytes.slice(0, 4).every((value, index) => value === [0x1a, 0x45, 0xdf, 0xa3][index]);
  return false;
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const parsed = await readBoundedJsonObject<Input>(request, { maxBytes: 512, allowedKeys: new Set(["attachmentId"]) });
  if (!parsed.ok) return parsed.response;
  if (!parsed.body.attachmentId || !uuidPattern.test(parsed.body.attachmentId)) return errorResponse("VALIDATION_ERROR", "A valid attachment is required.", 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return errorResponse("SUPABASE_NOT_CONFIGURED", "Secure attachment checks are not configured.", 503);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data: attachment, error: attachmentError } = await admin
    .from("attachments")
    .select("id,uploader_id,storage_path,mime_type,size_bytes,scan_status,status")
    .eq("id", parsed.body.attachmentId)
    .maybeSingle();

  if (attachmentError) return errorResponse("INTERNAL_ERROR", "Attachment verification is temporarily unavailable.", 503);
  if (!attachment || attachment.uploader_id !== auth.user.id || !["pending", "attached"].includes(attachment.status)) return errorResponse("BLOCKED", "This attachment cannot be checked from the current session.", 403);
  const expectedPath = new RegExp(`^communities/${uuidSource}/channels/${uuidSource}/pending/${auth.user.id}/${uuidSource}\\.(?:jpg|png|webp|gif|mp4|webm)$`, "i");
  if (!expectedPath.test(attachment.storage_path)) return errorResponse("BLOCKED", "This attachment path is not eligible for verification.", 403);
  if (attachment.scan_status === "clean") return jsonResponse({ scanStatus: "clean" });
  if (attachment.scan_status !== "pending") return errorResponse("BLOCKED", "This attachment is not eligible for verification.", 409);
  const maximumBytes = attachment.mime_type.startsWith("video/") ? maxVideoBytes : maxImageBytes;
  if (attachment.size_bytes < 1 || attachment.size_bytes > maximumBytes) {
    await admin.from("attachments").update({ scan_status: "failed" }).eq("id", attachment.id);
    return errorResponse("UPLOAD_TOO_LARGE", "The attachment did not pass the size check.", 422);
  }

  const { data: blob, error: downloadError } = await admin.storage.from("message-attachments").download(attachment.storage_path);
  if (downloadError || !blob) return errorResponse("INTERNAL_ERROR", "Attachment verification is temporarily unavailable. Retry the image.", 503);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const valid = bytes.byteLength === attachment.size_bytes
    && bytes.byteLength <= maximumBytes
    && (attachment.mime_type.startsWith("video/") ? matchesDeclaredVideo(bytes, attachment.mime_type) : matchesDeclaredImage(bytes, attachment.mime_type));
  if (!valid) {
    await admin.from("attachments").update({ scan_status: "failed" }).eq("id", attachment.id);
    return errorResponse("UPLOAD_INVALID_TYPE", "The attachment did not pass the media safety check.", 422);
  }

  const { error: updateError } = await admin.from("attachments").update({ scan_status: "clean" }).eq("id", attachment.id).eq("uploader_id", auth.user.id).eq("scan_status", "pending");
  if (updateError) return errorResponse("INTERNAL_ERROR", "Attachment verification is temporarily unavailable. Retry the image.", 503);
  return jsonResponse({ scanStatus: "clean" });
});
