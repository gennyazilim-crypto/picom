import { getSupabaseClient } from "../supabase/supabaseClient";
import type {
  CanStartPicomLiveStream,
  PublisherApplicationEligibility,
  PublisherApplicationSummary,
  PublisherProgramState,
  PublisherReviewQueueItem,
  SubmitPublisherApplicationInput,
} from "./publisherProgramTypes";

function mapRpcError(error: { message?: string; code?: string } | null): string {
  const message = String(error?.message || error?.code || "PUBLISHER_REQUEST_FAILED");
  if (/PUBLISHER_APPLICATION_NOT_ELIGIBLE/i.test(message)) return "PUBLISHER_APPLICATION_NOT_ELIGIBLE";
  if (/PUBLISHER_APPLICATION_ALREADY_OPEN/i.test(message)) return "PUBLISHER_APPLICATION_ALREADY_OPEN";
  if (/PUBLISHER_BROADCAST_NOT_ALLOWED/i.test(message)) return "PUBLISHER_BROADCAST_NOT_ALLOWED";
  if (/PUBLISHER_REVIEWER_REQUIRED/i.test(message)) return "PUBLISHER_REVIEWER_REQUIRED";
  if (/AUTH_REQUIRED/i.test(message)) return "AUTH_REQUIRED";
  return message.slice(0, 180);
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "AUTH_REQUIRED" };
  const { data, error } = await (client as unknown as {
    rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: T | null; error: { message?: string; code?: string } | null }>;
  }).rpc(fn, args);
  if (error) return { ok: false, error: mapRpcError(error) };
  return { ok: true, data: data as T };
}

export const publisherProgramService = {
  getEligibility: () => rpc<PublisherApplicationEligibility>("get_publisher_application_eligibility"),
  getProgramState: () => rpc<PublisherProgramState>("get_own_publisher_program_state"),
  listOwnApplications: () => rpc<PublisherApplicationSummary[]>("get_own_publisher_applications"),
  canStartLiveStream: () => rpc<CanStartPicomLiveStream>("can_start_picom_live_stream"),

  submitApplication(input: SubmitPublisherApplicationInput) {
    return rpc<unknown>("submit_publisher_creator_application", {
      target_application_type: input.applicationType,
      target_display_publisher_name: input.displayPublisherName,
      target_legal_name: input.legalName ?? "",
      target_country_code: input.countryCode ?? "",
      target_legal_address: input.legalAddress ?? "",
      target_categories: input.categories ?? [],
      target_short_bio: input.shortBio,
      target_experience_text: input.experienceText ?? "",
      target_stream_types: input.streamTypes ?? [],
      target_social_links: input.socialLinks ?? [],
      target_portfolio_links: input.portfolioLinks ?? [],
      target_company_name: input.companyName ?? null,
      target_trade_name: input.tradeName ?? null,
      target_company_registration_number: input.companyRegistrationNumber ?? null,
      target_tax_number: input.taxNumber ?? null,
      target_company_country_code: input.companyCountryCode ?? null,
      target_company_address: input.companyAddress ?? null,
      target_authorized_person_name: input.authorizedPersonName ?? null,
      target_authorized_person_title: input.authorizedPersonTitle ?? null,
      target_corporate_email: input.corporateEmail ?? null,
      target_website_url: input.websiteUrl ?? null,
    });
  },

  listReviewQueue(options?: {
    status?: string | null;
    type?: string | null;
    eligibilityFilter?: string | null;
    limit?: number;
  }) {
    return rpc<PublisherReviewQueueItem[]>("list_publisher_application_reviews", {
      target_status: options?.status ?? null,
      target_type: options?.type ?? null,
      target_eligibility_filter: options?.eligibilityFilter ?? null,
      target_limit: options?.limit ?? 50,
    });
  },

  reviewApplication(input: {
    applicationId: string;
    decision: "under_review" | "additional_information_required" | "approved" | "rejected" | "suspended" | "revoked";
    reason?: string;
    internalNotes?: string;
  }) {
    return rpc<unknown>("review_publisher_application", {
      target_application_id: input.applicationId,
      target_decision: input.decision,
      target_reason: input.reason ?? null,
      target_internal_notes: input.internalNotes ?? null,
    });
  },

  setLiveBan(userId: string, reason: string) {
    return rpc<unknown>("set_publisher_live_ban", {
      target_user_id: userId,
      target_reason: reason,
      target_expires_at: null,
    });
  },
};
