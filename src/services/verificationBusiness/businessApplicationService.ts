import { getSupabaseClient } from "../supabase/supabaseClient";
import type {
  BusinessApplicationApplicantDto, BusinessApplicationDraftInput, BusinessDocumentMimeType,
} from "../../types/verificationBusiness/businessApplication";

type Failure = Readonly<{ code?: string; message?: string }>;
type Response = Readonly<{ data: unknown; error: Failure | null }>;
interface PlatformClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>; }
const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const unavailable = () => ({ ok: false as const, error: { code: "NOT_CONFIGURED", message: "Business services are unavailable." } });
const failed = (error: Failure) => ({ ok: false as const, error: { code: error.code ?? "UNAVAILABLE", message: error.message ?? "Business request failed." } });

export const businessApplicationService = {
  async upsertDraft(payload: BusinessApplicationDraftInput) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("upsert_business_application_draft", { target_payload: payload });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },
  async submit(applicationId: string, idempotencyKey?: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("submit_business_application_snapshot", { target_application_id: applicationId, target_idempotency_key: idempotencyKey ?? null });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },
  async getApplicantDto(applicationId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("get_business_application_applicant_dto", { target_application_id: applicationId });
    return result.error ? failed(result.error) : { ok: true as const, data: result.data as BusinessApplicationApplicantDto };
  },
  /** RPCs require a concrete application id; callers keep their own current application reference. */
  async listMine(applicationId: string) { return this.getApplicantDto(applicationId); },
  async createDocumentRecord(input: Readonly<{ applicationId: string; documentType: string; fileName: string; mimeType: BusinessDocumentMimeType; storagePath: string; sha256: string }>) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_document_record", {
      target_application_id: input.applicationId, target_document_type: input.documentType, target_file_name: input.fileName,
      target_mime_type: input.mimeType, target_storage_path: input.storagePath, target_sha256: input.sha256,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },
  async completeDocumentUpload(documentId: string, sha256: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("complete_business_document_upload", { target_document_id: documentId, target_sha256: sha256 });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },
  async requestDomainVerification(organizationId: string, domain: string, method = "dns_txt") {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("request_business_domain_verification", { target_organization_id: organizationId, target_domain: domain, target_method: method });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },
};
