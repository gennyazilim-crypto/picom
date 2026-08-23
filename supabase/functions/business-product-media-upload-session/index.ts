import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Input = { productId?: string; organizationId?: string; fileName?: string; mimeType?: string; sha256?: string };
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request); if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  const auth = await requireSupabaseUser(request); if (!auth.ok) return auth.response;
  const body = await readBoundedJsonObject<Input>(request, {
    maxBytes: 4096,
    allowedKeys: new Set(["productId", "organizationId", "fileName", "mimeType", "sha256"]),
  });
  if (!body.ok) return body.response;
  const { productId, organizationId, fileName, mimeType, sha256 } = body.body;
  if (!productId || !organizationId || !fileName || !mimeType || !sha256 || !MIME_TYPES.has(mimeType) || /\.(svg|exe)$/i.test(fileName) || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return errorResponse("UPLOAD_INVALID_TYPE", "Product media metadata is invalid or unsupported.", 400);
  }
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceRole || !url) return errorResponse("SUPABASE_NOT_CONFIGURED", "Secure uploads are not configured.", 503);
  const bucket = Deno.env.get("BUSINESS_PRODUCT_MEDIA_BUCKET") || "business-product-media";
  const extension = EXTENSIONS[mimeType];
  const finalPath = `organizations/${organizationId}/products/${productId}/${crypto.randomUUID()}.${extension}`;
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const signed = await admin.storage.from(bucket).createSignedUploadUrl(finalPath, { upsert: false });
  if (signed.error || !signed.data) return errorResponse("INTERNAL_ERROR", "Upload session could not be created.", 503);
  // Media row creation remains RPC/client-authorized; malware_scan_status stays pending until a scanner exists.
  return jsonResponse({
    storagePath: finalPath,
    token: signed.data.token,
    signedUrl: signed.data.signedUrl,
    malwareScanStatus: "pending",
    processingStatus: mimeType.startsWith("video/") ? "blocked" : "pending",
  });
});
