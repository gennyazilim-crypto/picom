import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Input = { applicationId?: string; documentType?: string; fileName?: string; mimeType?: string; sha256?: string };
const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request); if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  const auth = await requireSupabaseUser(request); if (!auth.ok) return auth.response;
  const body = await readBoundedJsonObject<Input>(request, { maxBytes: 4096, allowedKeys: new Set(["applicationId", "documentType", "fileName", "mimeType", "sha256"]) });
  if (!body.ok) return body.response;
  const { applicationId, documentType, fileName, mimeType, sha256 } = body.body;
  if (!applicationId || !documentType || !fileName || !mimeType || !sha256 || !MIME_TYPES.has(mimeType) || /\.(svg|exe)$/i.test(fileName) || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return errorResponse("UPLOAD_INVALID_TYPE", "Document metadata is invalid or unsupported.", 400);
  }
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceRole || !url) return errorResponse("SUPABASE_NOT_CONFIGURED", "Secure uploads are not configured.", 503);
  const bucket = Deno.env.get("BUSINESS_DOCUMENT_BUCKET") || "business-verification-documents";
  const extension = EXTENSIONS[mimeType];
  // The RPC validates the final path against its organization-specific prefix. Resolve that safely first.
  const dto = await auth.supabase.rpc("get_business_application_applicant_dto", { target_application_id: applicationId });
  const organizationId = (dto.data as { organizationId?: string } | null)?.organizationId;
  if (dto.error || !organizationId) return errorResponse("AUTH_REQUIRED", "Application access could not be verified.", 403);
  const finalPath = `business-applications/${organizationId}/${applicationId}/${crypto.randomUUID()}.${extension}`;
  const record = await auth.supabase.rpc("create_business_document_record", {
    target_application_id: applicationId, target_document_type: documentType, target_file_name: fileName,
    target_mime_type: mimeType, target_storage_path: finalPath, target_sha256: sha256.toLowerCase(),
  });
  if (record.error) return errorResponse("VALIDATION_ERROR", "Document record could not be created.", 400);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const signed = await admin.storage.from(bucket).createSignedUploadUrl(finalPath, { upsert: false });
  if (signed.error || !signed.data) return errorResponse("INTERNAL_ERROR", "Upload session could not be created.", 503);
  return jsonResponse({ documentId: record.data, storagePath: finalPath, token: signed.data.token, signedUrl: signed.data.signedUrl });
});
